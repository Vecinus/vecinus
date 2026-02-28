from datetime import datetime
from typing import Optional
from uuid import UUID

from pydantic import BaseModel, EmailStr


class AssociationInfo(BaseModel):
    id: UUID
    name: str
    address: str


class MembershipWithCommunity(BaseModel):
    id: UUID
    association_id: UUID
    role: int
    property_id: Optional[UUID] = None
    joined_at: datetime
    neighborhood_associations: AssociationInfo


class InviteAdminRequest(BaseModel):
    association_id: UUID
    target_email: EmailStr
    role_to_grant: int  # 2-5, no puede ser 1 (ADMIN)


class InviteTenantRequest(BaseModel):
    association_id: UUID
    property_id: UUID
    target_email: EmailStr


class AcceptInvitationRequest(BaseModel):
    invitation_token: UUID
    password: str  # Para crear la cuenta en Supabase Auth


class InvitationResponse(BaseModel):
    id: UUID
    target_email: str
    association_id: UUID
    role_to_grant: int
    status: int
