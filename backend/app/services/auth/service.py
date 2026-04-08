from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.utils.security import get_password_hash, verify_password


class DuplicateEmailError(Exception):
    """Raised when a user already exists for the given email."""


class AuthenticationError(Exception):
    """Raised when credentials are invalid."""


def normalize_email(email: str) -> str:
    return email.strip().lower()


def get_user_by_email(db: Session, email: str) -> User | None:
    normalized_email = normalize_email(email)
    statement = select(User).where(User.email == normalized_email)
    return db.execute(statement).scalar_one_or_none()


def create_user(
    db: Session,
    *,
    email: str,
    password: str,
    full_name: str | None,
    role: UserRole,
) -> User:
    normalized_email = normalize_email(email)
    existing_user = get_user_by_email(db, normalized_email)
    if existing_user is not None:
        raise DuplicateEmailError("A user with this email already exists.")

    user = User(
        email=normalized_email,
        hashed_password=get_password_hash(password),
        full_name=full_name.strip() if full_name else None,
        role=role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def authenticate_user(db: Session, *, email: str, password: str) -> User:
    user = get_user_by_email(db, email)
    if user is None or not verify_password(password, user.hashed_password):
        raise AuthenticationError("Invalid email or password.")
    return user
