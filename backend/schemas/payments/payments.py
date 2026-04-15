from datetime import datetime
from typing import List, Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator


class CommunityDraft(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    address: str = Field(..., min_length=1, max_length=300)

    @field_validator("name", "address")
    @classmethod
    def strip_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Value cannot be empty")
        return stripped


class CommunityPaymentOrderCreate(BaseModel):
    quantity: int = Field(..., gt=0, le=20)
    communities: List[CommunityDraft]

    @field_validator("communities")
    @classmethod
    def ensure_items_present(cls, value: List[CommunityDraft]) -> List[CommunityDraft]:
        if not value:
            raise ValueError("At least one community is required")
        return value


class CommunityOrderItemResponse(BaseModel):
    id: UUID
    community_name: str
    community_address: str
    price_cents: int
    status: str
    created_association_id: Optional[UUID] = None
    created_at: datetime
    updated_at: datetime


class CommunityPaymentOrderResponse(BaseModel):
    id: UUID
    quantity: int
    unit_amount_cents: int
    total_amount_cents: int
    currency: str
    status: str
    authorisation_url: Optional[str] = None
    billing_request_id: Optional[str] = None
    billing_request_flow_id: Optional[str] = None
    mandate_id: Optional[str] = None
    payment_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    items: List[CommunityOrderItemResponse]


class RegistrationOrderCreate(BaseModel):
    email: EmailStr
    username: str = Field(..., min_length=1, max_length=100)
    community_name: str = Field(..., min_length=1, max_length=200)
    community_address: str = Field(..., min_length=1, max_length=300)

    @field_validator("username", "community_name", "community_address")
    @classmethod
    def strip_registration_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("Value cannot be empty")
        return stripped


class RegistrationOrderComplete(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)


class RegistrationPaymentOrderResponse(BaseModel):
    id: UUID
    email: EmailStr
    username: str
    community_name: str
    community_address: str
    amount_cents: int
    currency: str
    status: str
    authorisation_url: Optional[str] = None
    billing_request_id: Optional[str] = None
    billing_request_flow_id: Optional[str] = None
    mandate_id: Optional[str] = None
    payment_id: Optional[str] = None
    created_profile_id: Optional[UUID] = None
    created_association_id: Optional[UUID] = None
    granted_role: int
    granted_role_label: str
    token: Optional[str] = None
    created_at: datetime
    updated_at: datetime
