import sqlite3
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
import pickle

# Load Data from SQLite Database
conn = sqlite3.connect("network_devices.db")
df = pd.read_sql_query("SELECT * FROM devices", conn)
print(df)
conn.close()

df["mac_prefix"] = df["mac_address"].str[:8]  
df["hostname_len"] = df["hostname"].apply(lambda x: len(x) if x != "Unknown" else 0)

df["device_type"] = df["device_type"].astype("category").cat.codes

X = df[["hostname_len"]] 
y = df["device_type"]

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

model = RandomForestClassifier(n_estimators=100)
model.fit(X_train, y_train)

with open("device_classifier.pkl", "wb") as file:
    pickle.dump(model, file)

print("✅ AI Model Trained & Saved!")
