from uuid import UUID


class EscrutinioService:
    def __init__(self, supabase_admin_client):
        self.supabase = supabase_admin_client

    def calculate_results(self, poll_id: UUID, association_id: UUID):
        poll_res = self.supabase.table("dev_s2.poll").select("options").eq("id", str(poll_id)).execute()
        options = poll_res.data[0]["options"]

        props_res = (
            self.supabase.table("dev_s2.properties")
            .select("coefficient, is_defaulter")
            .eq("association_id", str(association_id))
            .execute()
        )

        eligible_voters = 0
        eligible_coefficient = 0.0

        for prop in props_res.data:
            if not prop["is_defaulter"]:
                eligible_voters += 1
                eligible_coefficient += float(prop["coefficient"])

        votes_res = (
            self.supabase.table("dev_s2.vote")
            .select("selected_option, coefficient_snapshot, is_presumed_vote, memberships(properties(number))")
            .eq("poll_id", str(poll_id))
            .execute()
        )

        results = []
        voters_list = []

        total_votes_cast = len(votes_res.data)
        presumed_votes_count = 0

        for option in options:
            option_votes = [v for v in votes_res.data if v["selected_option"] == option]

            total_option_count = len(option_votes)
            total_option_coeff = sum(float(v["coefficient_snapshot"]) for v in option_votes)

            presumed = sum(1 for v in option_votes if v["is_presumed_vote"])
            presumed_votes_count += presumed

            results.append(
                {
                    "option_text": option,
                    "total_votes_count": total_option_count,
                    "total_coefficient": round(total_option_coeff, 2),
                }
            )

            for v in option_votes:
                member_data = v.get("memberships") or {}
                prop_data = member_data.get("properties") or {}

                if isinstance(prop_data, list) and len(prop_data) > 0:
                    door_number = prop_data[0].get("number", "Desconocido")
                elif isinstance(prop_data, dict):
                    door_number = prop_data.get("number", "Desconocido")
                else:
                    door_number = "Desconocido"

                voters_list.append(
                    {
                        "property_number": door_number,
                        "voted_for": option,
                        "coefficient": float(v["coefficient_snapshot"]),
                        "is_presumed": v["is_presumed_vote"],
                    }
                )

        return {
            "poll_id": poll_id,
            "census_eligible_voters": eligible_voters,
            "census_eligible_coefficient": round(eligible_coefficient, 2),
            "total_votes_cast": total_votes_cast,
            "presumed_votes_applied": presumed_votes_count,
            "results": results,
            "voters_list": voters_list,
        }
