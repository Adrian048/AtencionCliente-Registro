import pytest

from triage_api.crypto import DecryptionError, FieldCipher, generate_master_key


@pytest.fixture
def cipher() -> FieldCipher:
    return FieldCipher(generate_master_key())


def test_roundtrip(cipher: FieldCipher) -> None:
    blob = cipher.encrypt("Lucía García", "nombre")

    assert b"Luc" not in blob
    assert cipher.decrypt(blob, "nombre") == "Lucía García"


def test_same_value_encrypts_differently_each_time(cipher: FieldCipher) -> None:
    # Random nonce: equal plaintexts must not be recognisable in the database.
    assert cipher.encrypt("ana@example.com", "email") != cipher.encrypt("ana@example.com", "email")


def test_tampered_ciphertext_is_rejected(cipher: FieldCipher) -> None:
    blob = bytearray(cipher.encrypt("secreto", "consulta"))
    blob[-1] ^= 0x01

    with pytest.raises(DecryptionError):
        cipher.decrypt(bytes(blob), "consulta")


def test_ciphertext_is_bound_to_its_column(cipher: FieldCipher) -> None:
    blob = cipher.encrypt("ana@example.com", "email")

    with pytest.raises(DecryptionError):
        cipher.decrypt(blob, "nombre")


def test_wrong_key_cannot_decrypt(cipher: FieldCipher) -> None:
    other = FieldCipher(generate_master_key())

    with pytest.raises(DecryptionError):
        other.decrypt(cipher.encrypt("dato", "nombre"), "nombre")


def test_unknown_version_is_rejected(cipher: FieldCipher) -> None:
    blob = cipher.encrypt("dato", "nombre")

    with pytest.raises(DecryptionError):
        cipher.decrypt(b"\x09" + blob[1:], "nombre")


def test_optional_helpers(cipher: FieldCipher) -> None:
    assert cipher.encrypt_optional(None, "resumen") is None
    assert cipher.decrypt_optional(None, "resumen") is None
    assert cipher.decrypt_optional(cipher.encrypt_optional("x", "resumen"), "resumen") == "x"


def test_blind_index_is_deterministic_and_normalised(cipher: FieldCipher) -> None:
    assert cipher.blind_index("Ana@Example.com ") == cipher.blind_index("ana@example.com")
    assert cipher.blind_index("ana@example.com") != cipher.blind_index("eva@example.com")
    assert b"ana" not in cipher.blind_index("ana@example.com")


def test_blind_index_depends_on_key() -> None:
    a, b = FieldCipher(generate_master_key()), FieldCipher(generate_master_key())

    assert a.blind_index("ana@example.com") != b.blind_index("ana@example.com")


@pytest.mark.parametrize("bad", ["not base64!!", "c2hvcnQ="])
def test_invalid_master_key(bad: str) -> None:
    with pytest.raises(ValueError):
        FieldCipher(bad)
