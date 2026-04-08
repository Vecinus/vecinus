import { useAuth } from "@/context/AuthContext";

export const useRole = () => {
  const { user, activeCommunity } = useAuth();

  if (!user || !activeCommunity) return null;

    const membership = user.CommunitiesAndRole.find(
      (item) => item.community.id === activeCommunity.id
    );
  return membership ? Number(membership.role) : 0;
};
