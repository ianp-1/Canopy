import pandas as pd
import numpy as np
import os
import joblib
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import roc_auc_score, confusion_matrix, classification_report

# Configuration
BASE_DIR = os.getcwd() # Assumption: running from project root or data dir
# Adjust based on where we run it. If running from xrp_farmer/data, getcwd is fine if data files are there.
# But files are in data/ (relative to xrp_farmer) if running from root.
# Let's assume we run from xrp_farmer/data.

# We need to make sure paths are correct.
# The user's cwd for previous commands was /Users/nickchong/Desktop/xrp_farmer
# But file paths in notebook were constructed relative to BASE_DIR which was os.getcwd().
# If we run this script from data/, then BASE_DIR is .../data.
# The files are in .../data.

# Let's set paths explicitly to match what the previous scripts did
BASE_DIR = "/Users/nickchong/Desktop/xrp_farmer/data"
INPUT_FILE = os.path.join(BASE_DIR, "PA_2020-2022_weekly_stress_labeled.csv")
MODEL_FILE = os.path.join(BASE_DIR, "model_logreg_2020-2022.joblib")
CONFUSION_MATRIX_FILE = os.path.join(BASE_DIR, "confusion_matrix.png")

print(f"Loading data from {INPUT_FILE}...")
labeled = pd.read_csv(INPUT_FILE)

print(f"Loading model from {MODEL_FILE}...")
model = joblib.load(MODEL_FILE)

# Prepare Data
features = ["rain_stress", "heat_stress", "vpd_stress"]
X = labeled[features]
y = labeled["severity"]

# Split (must match the seed used in training to be valid, though ideally we test on unseen data.
# The previous script did a train/test split. We should re-do the split to get X_test.
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Predict
print("Generating predictions...")
preds_proba = model.predict_proba(X_test)[:, 1]
preds = model.predict(X_test)

# Metrics
auc = roc_auc_score(y_test, preds_proba)
print(f"ROC-AUC: {auc:.4f}")

print("\nClassification Report:")
print(classification_report(y_test, preds))

print("Confusion Matrix:")
cm = confusion_matrix(y_test, preds)
print(cm)

# Plot
plt.figure(figsize=(6, 5))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', cbar=False)
plt.xlabel('Predicted')
plt.ylabel('Actual')
plt.title('Confusion Matrix')
plt.savefig(CONFUSION_MATRIX_FILE)
print(f"Saved confusion matrix plot to {CONFUSION_MATRIX_FILE}")
