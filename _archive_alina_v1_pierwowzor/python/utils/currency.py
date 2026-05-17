
from typing import Union
from decimal import Decimal, ROUND_HALF_UP

def round_currency(value: Union[float, str, None]) -> float:
    """
    Wymusza 2 miejsca po przecinku.
    Odpowiednik TypeScript: Math.round((num + Number.EPSILON) * 100) / 100
    """
    if value is None:
        return 0.00
    
    if isinstance(value, str):
        try:
            value = float(value.replace(',', '.'))
        except ValueError:
            return 0.00
            
    # Używamy Decimal do precyzyjnego zaokrąglania finansowego
    d = Decimal(str(value))
    rounded = d.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return float(rounded)

def format_currency(value: Union[float, str, None]) -> str:
    val = round_currency(value)
    return f"{val:.2f}"

def calculate_rate(premium: float, commission: float) -> float:
    if not premium or premium == 0:
        return 0.0
    
    rate = (commission / premium) * 100
    # Zaokrąglenie do 1 miejsca po przecinku (np. 12.5%)
    d = Decimal(str(rate))
    rounded = d.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP)
    return float(rounded)
