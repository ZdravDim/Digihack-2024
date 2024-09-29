import asyncio
import websockets

# Define the WebSocket server handler
async def handle_client(websocket, path):
    print(f"Client connected: {path}")

    try:
        async for message in websocket:
            print(f"Received message: {message}")
            response_message = f"Server received: {message}"

            # Send the response back to the client
            await websocket.send(response_message)
            print(f"Sent message: {response_message}")
    except websockets.ConnectionClosedOK:
        print("Client disconnected")

# Start the WebSocket server
async def start_server():
    # Specify the host and port for the WebSocket server
    server = await websockets.serve(handle_client, "localhost", 8765)

    print("WebSocket server started on ws://localhost:8765")
    await server.wait_closed()


if __name__ == "__main__":
    asyncio.run(start_server())
