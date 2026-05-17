
from ..utils.currency import round_currency, calculate_rate
from ..models import PolicySubAgentShare, SubAgent

class CommissionEngine:
    
    @staticmethod
    def calculate_splits(
        premium: float, 
        agent_commission: float, # Całość od TU
        splits: list[PolicySubAgentShare]
    ) -> dict:
        """
        Przelicza podział prowizji.
        """
        premium = round_currency(premium)
        agent_commission = round_currency(agent_commission)
        
        calculated_splits = []
        total_sub_cost = 0.0
        
        for split in splits:
            # Jeśli podano stawkę %, przelicz kwotę
            if split.rate > 0:
                amount = round_currency((premium * split.rate) / 100)
                calculated_splits.append(split.model_copy(update={'amount': amount}))
                total_sub_cost += amount
            # Jeśli podano kwotę, przelicz stawkę %
            elif split.amount > 0:
                rate = calculate_rate(premium, split.amount)
                calculated_splits.append(split.model_copy(update={'rate': rate}))
                total_sub_cost += split.amount
                
        agent_net = round_currency(agent_commission - total_sub_cost)
        
        return {
            "premium": premium,
            "total_commission_gross": agent_commission, # Co przyszło od TU
            "sub_agents_cost": round_currency(total_sub_cost),
            "agent_net": agent_net, # Co zostaje w kieszeni
            "splits": calculated_splits
        }

    @staticmethod
    def get_default_rate(sub_agent: SubAgent, policy_type: str) -> float:
        return sub_agent.defaultRates.get(policy_type, 0.0)
