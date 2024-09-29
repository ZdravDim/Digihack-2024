import joblib
import tensorflow as tf
import numpy as np
import random
import pandas as pd

TEMP_NORMAL = (36.1, 37.2)
TEMP_CRITICAL_HIGH = 39.0

BPM_NORMAL = (60, 100)
BPM_CRITICAL_HIGH = 150

OXYGEN_NORMAL = (95, 100)
OXYGEN_CRITICAL_LOW = 85

BLOOD_PRESSURE_SYSTOLIC_NORMAL = (90, 120)
BLOOD_PRESSURE_SYSTOLIC_CRITICAL = 180

BLOOD_PRESSURE_DIASTOLIC_NORMAL = (60, 80)
BLOOD_PRESSURE_DIASTOLIC_CRITICAL = 120

BLOOD_SUGAR_NORMAL = (70, 140)
BLOOD_SUGAR_CRITICAL_HIGH = 250

RESPIRATORY_RATE_NORMAL = (12, 20)
RESPIRATORY_RATE_CRITICAL_HIGH = 35


# Simulate one hour of data (60 minutes) instead of one minute per second for each patient
def simulate_hour_data(normal_range, size=60, critical_value=None, critical_chance=0.1):
    values = np.random.uniform(normal_range[0], normal_range[1], size)
    if critical_value is not None and random.random() < critical_chance:
        critical_time = random.randint(30, 59)
        values[critical_time:] = critical_value
        return values, critical_time
    return values, None


def create_dataset(hours=1):
    patient_data = {
        "temperature": [],
        "heart_rate": [],
        "oxygen_saturation": [],
        "blood_pressure_systolic": [],
        "blood_pressure_diastolic": [],
        "blood_sugar": [],
        "respiratory_rate": []
    }
    labels = []  # For marking critical events

    # Simulate data for each patient for each hour
    for patient in range(8):
        for _ in range(hours):
            temp_values, temp_critical_time = simulate_hour_data(TEMP_NORMAL, critical_value=TEMP_CRITICAL_HIGH)
            bpm_values, bpm_critical_time = simulate_hour_data(BPM_NORMAL, critical_value=BPM_CRITICAL_HIGH)
            oxygen_values, oxygen_critical_time = simulate_hour_data(OXYGEN_NORMAL, critical_value=OXYGEN_CRITICAL_LOW)
            bp_systolic_values, bp_systolic_critical_time = simulate_hour_data(BLOOD_PRESSURE_SYSTOLIC_NORMAL,
                                                                               critical_value=BLOOD_PRESSURE_SYSTOLIC_CRITICAL)
            bp_diastolic_values, bp_diastolic_critical_time = simulate_hour_data(BLOOD_PRESSURE_DIASTOLIC_NORMAL,
                                                                                 critical_value=BLOOD_PRESSURE_DIASTOLIC_CRITICAL)
            sugar_values, sugar_critical_time = simulate_hour_data(BLOOD_SUGAR_NORMAL,
                                                                   critical_value=BLOOD_SUGAR_CRITICAL_HIGH)
            respiratory_values, respiratory_critical_time = simulate_hour_data(RESPIRATORY_RATE_NORMAL,
                                                                               critical_value=RESPIRATORY_RATE_CRITICAL_HIGH)

            # Append data for each patient
            patient_data["temperature"].append(temp_values)
            patient_data["heart_rate"].append(bpm_values)
            patient_data["oxygen_saturation"].append(oxygen_values)
            patient_data["blood_pressure_systolic"].append(bp_systolic_values)
            patient_data["blood_pressure_diastolic"].append(bp_diastolic_values)
            patient_data["blood_sugar"].append(sugar_values)
            patient_data["respiratory_rate"].append(respiratory_values)

            # Label the minute as critical (1) if any parameter is critical, otherwise non-critical (0)
            critical_labels = np.zeros(60)
            if temp_critical_time is not None:
                critical_labels[temp_critical_time:] = 1
            if bpm_critical_time is not None:
                critical_labels[bpm_critical_time:] = 1
            if oxygen_critical_time is not None:
                critical_labels[oxygen_critical_time:] = 1
            if bp_systolic_critical_time is not None:
                critical_labels[bp_systolic_critical_time:] = 1
            if bp_diastolic_critical_time is not None:
                critical_labels[bp_diastolic_critical_time:] = 1
            if sugar_critical_time is not None:
                critical_labels[sugar_critical_time:] = 1
            if respiratory_critical_time is not None:
                critical_labels[respiratory_critical_time:] = 1

            labels.append(critical_labels)

    return patient_data, np.array(labels)


model = tf.keras.models.load_model("model/my_model.h5")

# Simulate one hour of new data (this is just for illustration; in real use, you would get this data from actual patient monitoring systems)
new_patient_data, _ = create_dataset(hours=24)  # Simulate new hour data (without critical event labels)

# Convert this new data into a DataFrame
new_data_df = pd.DataFrame({
    'temperature': np.concatenate(new_patient_data['temperature']),
    'heart_rate': np.concatenate(new_patient_data['heart_rate']),
    'oxygen_saturation': np.concatenate(new_patient_data['oxygen_saturation']),
    'blood_pressure_systolic': np.concatenate(new_patient_data['blood_pressure_systolic']),
    'blood_pressure_diastolic': np.concatenate(new_patient_data['blood_pressure_diastolic']),
    'blood_sugar': np.concatenate(new_patient_data['blood_sugar']),
    'respiratory_rate': np.concatenate(new_patient_data['respiratory_rate'])
})

# Prepare the new data for LSTM input (without labels, since we're predicting)
def prepare_new_data(df, look_back=60):
    X = df.values  # Only features
    X_reshaped = X.reshape(-1, look_back, X.shape[1])
    return X_reshaped

X_new = prepare_new_data(new_data_df)
loaded_scaler = joblib.load('scaler.pkl')
# Scale the new data using the same scaler used for training
X_new_scaled = loaded_scaler.transform(X_new.reshape(-1, X_new.shape[-1])).reshape(X_new.shape)

# Predict critical events for the next hour
predictions = model.predict(X_new_scaled)
for patient in range(predictions.shape[0]):
    print(f"Patient {patient + 1}:")
    print(predictions[patient].flatten())
# Since the model outputs probabilities (because we used a sigmoid activation function),
# we can apply a threshold (e.g., 0.5) to determine if a critical event is likely to occur
# critical_event_threshold = 0.5
# predicted_critical_events = (predictions > critical_event_threshold).astype(int)
#
# # Output the predictions
# print("Predicted critical events for the next hour (minute by minute):")
# for patient in range(predicted_critical_events.shape[0]):
#     print(f"Patient {patient + 1}:")
#     print(predicted_critical_events[patient].flatten())  # Flatten to get a 1D array of predictions