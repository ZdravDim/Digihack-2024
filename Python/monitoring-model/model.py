import joblib
import numpy as np
import random
import pandas as pd
import os

# Set the environment variable
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'

# Constants for parameter ranges and critical event threshold values remain the same as before
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
def simulate_hour_data(normal_range, size=100, critical_value=None, critical_chance=0.1):
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
            critical_labels = np.zeros(100)
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


# Create the dataset
patient_data, labels = create_dataset(hours=1)

# Convert the dataset into a pandas DataFrame for easier handling
data_df = pd.DataFrame({
    'temperature': np.concatenate(patient_data['temperature']),
    'heart_rate': np.concatenate(patient_data['heart_rate']),
    'oxygen_saturation': np.concatenate(patient_data['oxygen_saturation']),
    'blood_pressure_systolic': np.concatenate(patient_data['blood_pressure_systolic']),
    'blood_pressure_diastolic': np.concatenate(patient_data['blood_pressure_diastolic']),
    'blood_sugar': np.concatenate(patient_data['blood_sugar']),
    'respiratory_rate': np.concatenate(patient_data['respiratory_rate']),
    'label': np.concatenate(labels)
})

import tensorflow as tf
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# Prepare data for LSTM (reshaping into sequences)
def prepare_lstm_data(df, look_back=100):
    X = df.drop(columns=['label']).values  # Features (all vitals)
    y = df['label'].values  # Target (critical event)

    # Reshape the data to be 3D [samples, timesteps, features]
    X_reshaped = X.reshape(-1, look_back, X.shape[1])
    y_reshaped = y.reshape(-1, look_back)

    return X_reshaped, y_reshaped

# Split into training and test data
X, y = prepare_lstm_data(data_df)
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Scale the data
scaler = StandardScaler()
X_train = scaler.fit_transform(X_train.reshape(-1, X_train.shape[-1])).reshape(X_train.shape)
X_test = scaler.transform(X_test.reshape(-1, X_test.shape[-1])).reshape(X_test.shape)

# Build LSTM model
model = tf.keras.Sequential([
    tf.keras.layers.LSTM(64, return_sequences=True, input_shape=(X_train.shape[1], X_train.shape[2])),
    tf.keras.layers.LSTM(64, return_sequences=True),
    tf.keras.layers.TimeDistributed(tf.keras.layers.Dense(1, activation='sigmoid'))
])

model.compile(optimizer='adam', loss='binary_crossentropy', metrics=['accuracy'])

# Train the model
history = model.fit(X_train, y_train, epochs=10, batch_size=16, validation_data=(X_test, y_test))

# Evaluate the model
loss, accuracy = model.evaluate(X_test, y_test)
print(f"Test Accuracy: {accuracy * 100:.2f}%")

model.save('my_model.h5')
joblib.dump(scaler, 'scaler.pkl')