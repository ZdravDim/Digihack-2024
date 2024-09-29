import asyncio
import json
import pandas as pd
from websockets.server import serve

PATIENT_NUMBER = 8
sent_data_counter = 0
patient_dataframes = []

# Load the CSV data for a specific patient
def load_patient_data(patient_id):
    filename = f"data/patient_{patient_id}_data.csv"
    patient_df = pd.read_csv(filename)
    return patient_df

# Load all patient data into DataFrames
def load_dataframes():
    for patient_id in range(PATIENT_NUMBER):
        patient_df = load_patient_data(patient_id + 1)
        patient_dataframes.append(patient_df)

# Send patient vitals every 2 seconds
async def send_patient_data(websocket):
    global sent_data_counter

    while True:
        new_data = []
        for patient_df in patient_dataframes:
            if sent_data_counter >= len(patient_df):
                continue  # Stop if we reach the end of the patient data
            data = patient_df.iloc[sent_data_counter].to_dict()
            new_data.append(data)

        # Convert to a JSON string to send via WebSocket
        message = json.dumps(new_data)
        await websocket.send(message)
        print(f"Sent: {message}")

        # Wait for 2 seconds before sending the next update
        await asyncio.sleep(2)
        sent_data_counter += 1


def calculate_critical_bar(df):
    chunk_size = 60  # Each block is 60 rows
    total_chunks = 24  # We need to calculate for 24 chunks
    critical_bar_values = []
    # Starting value

    for i in range(total_chunks):
        critical_bar = 0.05
        # Get the next 60 rows (one chunk)
        chunk = df.iloc[i * chunk_size: (i + 1) * chunk_size]

        # Process each row in the chunk
        for _, row in chunk.iterrows():
            if row['state'] == 'critical':
                critical_bar += 0.1
            elif row['state'] == 'needs medics':
                critical_bar += 0.05

            # Ensure critical_bar does not exceed 1.0
            if critical_bar > 1.0:
                critical_bar = 1.0

        # Store the critical_bar value for this chunk
        critical_bar_values.append(critical_bar)
    return critical_bar_values

def get_daily_report():
    critical_bars_report = []
    for patient_df in patient_dataframes:
        critical_bars_report.append(calculate_critical_bar(patient_df))
    return critical_bars_report

async def main():
    load_dataframes()  # Load all patient data before starting the server
    async with serve(send_patient_data, "localhost", 8000):
        await asyncio.Future()  # Run forever

# Start the WebSocket server
asyncio.run(main())

