"""Session-cookie authentication for the single panel admin."""

import secrets
import time
from collections import defaultdict, deque
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status

from triage_api.config import Settings, get_settings
from triage_api.passwords import verify_password
from triage_api.schemas import LoginRequest, Me

router = APIRouter(prefix="/api/auth", tags=["auth"])

SESSION_USER_KEY = "user"


class LoginThrottle:
    """In-memory sliding window of failed attempts per client IP.

    Good enough for a single-instance demo; a multi-instance deployment would
    move this to Redis or the reverse proxy.
    """

    def __init__(self, max_attempts: int, window_seconds: int) -> None:
        self.max_attempts = max_attempts
        self.window = window_seconds
        self._failures: dict[str, deque[float]] = defaultdict(deque)

    def _prune(self, key: str, now: float) -> deque[float]:
        attempts = self._failures[key]
        while attempts and now - attempts[0] > self.window:
            attempts.popleft()
        return attempts

    def is_blocked(self, key: str) -> bool:
        return len(self._prune(key, time.monotonic())) >= self.max_attempts

    def register_failure(self, key: str) -> None:
        self._failures[key].append(time.monotonic())

    def reset(self, key: str) -> None:
        self._failures.pop(key, None)


def get_throttle(request: Request) -> LoginThrottle:
    throttle: LoginThrottle = request.app.state.login_throttle
    return throttle


def current_user(request: Request) -> str:
    user = request.session.get(SESSION_USER_KEY)
    if not isinstance(user, str):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Not authenticated")
    return user


CurrentUser = Annotated[str, Depends(current_user)]


@router.post("/login", response_model=Me)
def login(
    body: LoginRequest,
    request: Request,
    settings: Annotated[Settings, Depends(get_settings)],
    throttle: Annotated[LoginThrottle, Depends(get_throttle)],
) -> Me:
    client = request.client.host if request.client else "unknown"
    if throttle.is_blocked(client):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts, try later")

    # Always run the hash check, even for a wrong username, so response time
    # doesn't reveal whether the user exists.
    password_ok = verify_password(body.password, settings.admin_password_hash.get_secret_value())
    user_ok = secrets.compare_digest(body.username, settings.admin_user)
    if not (password_ok and user_ok):
        throttle.register_failure(client)
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid credentials")

    throttle.reset(client)
    request.session.clear()  # avoid session fixation
    request.session[SESSION_USER_KEY] = body.username
    return Me(username=body.username)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(request: Request) -> Response:
    request.session.clear()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/me", response_model=Me)
def me(user: CurrentUser) -> Me:
    return Me(username=user)
