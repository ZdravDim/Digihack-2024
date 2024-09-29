from websockets.sync.client import connect

def get_patient_vitals():
    with connect("ws://localhost:8000") as websocket:
        while True:
            message = websocket.recv()
            print(message)

get_patient_vitals()