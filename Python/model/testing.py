import numpy as np
import pandas as pd
from keras.models import load_model

# Modified data to introduce more diverse cases and reduce stroke risk
data = {
    'id': [9046, 51676, 31112, 60182, 1665, 56669, 53882, 10434, 27419, 60491, 12109, 12095, 12175, 8213, 5317, 58202],
    'gender': ['Male', 'Female', 'Male', 'Female', 'Female', 'Male', 'Male', 'Female', 'Female', 'Female', 'Female', 'Female', 'Female', 'Male', 'Female', 'Female'],
    'age': [45, 30, 40, 49, 60, 55, 42, 38, 35, 50, 55, 48, 30, 45, 47, 32],  # Adjusted to younger ages
    'hypertension': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'heart_disease': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    'ever_married': ['Yes', 'Yes', 'No', 'Yes', 'Yes', 'Yes', 'No', 'No', 'Yes', 'Yes', 'Yes', 'Yes', 'No', 'Yes', 'Yes', 'Yes'],
    'work_type': ['Private', 'Self-employed', 'Private', 'Private', 'Self-employed', 'Private', 'Private', 'Private', 'Private', 'Private', 'Private', 'Govt_job', 'Private', 'Private', 'Private', 'Self-employed'],
    'Residence_type': ['Urban', 'Rural', 'Rural', 'Urban', 'Rural', 'Urban', 'Rural', 'Urban', 'Rural', 'Urban', 'Rural', 'Rural', 'Urban', 'Urban', 'Urban', 'Rural'],
    'avg_glucose_level': [80.0, 95.0, 99.0, 90.0, 102.0, 88.0, 95.0, 85.0, 98.0, 94.0, 110.0, 90.0, 95.0, 92.0, 99.0, 89.0],  # Lower glucose levels
    'bmi': [24.0, 22.0, 23.0, 24.5, 22.0, 25.0, 26.0, 23.5, 24.0, 23.0, 22.5, 21.5, 23.0, 22.8, 23.2, 24.0],  # More normal and healthy BMI values
    'smoking_status': ['never smoked', 'never smoked', 'never smoked', 'never smoked', 'never smoked', 'never smoked', 'never smoked', 'never smoked', 'never smoked', 'never smoked', 'never smoked', 'never smoked', 'never smoked', 'never smoked', 'never smoked', 'never smoked'],  # All nonsmokers
    'stroke': [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
}

# Convert the dictionary into a DataFrame
df = pd.DataFrame(data)

# Preprocessing as per the original model's preprocessing steps
# Fill missing BMI values with the mean
df['bmi'] = df['bmi'].fillna(df['bmi'].mean())

# Convert categorical columns to numeric
df['gender'] = np.where(df.gender == 'Male', 0, np.where(df.gender == 'Female', 1, 2))
df['ever_married'] = np.where(df.ever_married == 'Yes', 1, 0)
df['work_type'] = df['work_type'].map({
    'Private': 0, 'Self-employed': 1, 'Govt_job': 2, 'children': 3, 'Never_worked': 4
})
df['Residence_type'] = np.where(df.Residence_type == 'Urban', 0, 1)
df['smoking_status'] = df['smoking_status'].map({
    'formerly smoked': 0, 'never smoked': 1, 'smokes': 2, 'Unknown': 3
})

# Bin age, avg_glucose_level, and bmi as per original code
df.loc[df['age'] <= 18, 'age'] = 0  # children
df.loc[(df['age'] > 18) & (df['age'] <= 35), 'age'] = 1  # adults
df.loc[(df['age'] > 35) & (df['age'] <= 65), 'age'] = 2  # older adults
df.loc[(df['age'] > 65), 'age'] = 3  # elderly

df.loc[df['avg_glucose_level'] <= 100, 'avg_glucose_level'] = 0  # normal
df.loc[(df['avg_glucose_level'] > 100) & (df['avg_glucose_level'] <= 125), 'avg_glucose_level'] = 1  # pre-diabetes
df.loc[df['avg_glucose_level'] > 125, 'avg_glucose_level'] = 2  # diabetes

df.loc[df['bmi'] <= 18.5, 'bmi'] = 0  # underweight
df.loc[(df['bmi'] > 18.5) & (df['bmi'] <= 24.9), 'bmi'] = 1  # normal
df.loc[(df['bmi'] > 24.9) & (df['bmi'] <= 29.9), 'bmi'] = 2  # overweight
df.loc[df['bmi'] > 29.9, 'bmi'] = 3  # obese

# Drop the stroke and id columns as they are not inputs for predictions
x = df.drop(['stroke', 'id'], axis=1)

# Load the model
model = load_model('stroke-model.h5')

# Make predictions
predictions = model.predict(x)

# Print predictions without scientific notation
pd.options.display.float_format = '{:.6f}'.format  # Format to 6 decimal places

# Print the formatted predictions
df['predicted_probability_of_stroke'] = predictions
print(df[['id', 'predicted_probability_of_stroke']])
