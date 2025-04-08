import pyshark

# Define the IP address you want to monitor
target_ip = "192.168.3.123"  # Change this to the IP you're interested in

# Define the interface to capture traffic on
interface = r"\Device\NPF_{43FB1D3E-360A-47BD-AF8B-5F6E354A71FE}"  # Replace with the correct interface

# Define a capture filter to capture packets only from/to the target IP address
capture_filter = f"host {target_ip}"

# Start capturing packets on the specified interface with the filter
capture = pyshark.LiveCapture(interface=interface, display_filter=capture_filter)

# Continuously capture and display HTTP/HTTPS packets in real-time
print("Starting real-time capture. Press Ctrl+C to stop.")

try:
    # Capture packets in real-time
    for packet in capture.sniff_continuously():  # No packet count limit
        try:
            # Check if the packet has a layer with HTTP/HTTPS protocol
            if 'HTTP' in packet:
                print(f"HTTP packet: {packet.http}")
            elif 'TLS' in packet:
                print(f"HTTPS packet: {packet.tls}")
        except AttributeError:
            # Some packets might not have the HTTP or TLS layers
            continue
except KeyboardInterrupt:
    print("\nCapture stopped by user.")
