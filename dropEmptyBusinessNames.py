import json
import re

def drop_features_with_invalid_business_name(input_file, output_file):
    # Load the JSON data
    with open(input_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Filter features
    filtered_features = []
    for feature in data["features"]:
        properties = feature.get("properties", {})
        description = properties.get("Description", "")

        # Check for exact matches of "NA" or "NIL" in Description
        has_na_or_nil = re.search(r'\b(NA|NIL)\b', description)

        # Extract BUSINESS_NAME from Description if available
        business_name = ""
        match = re.search(r'<th>BUSINESS_NAME<\/th>\s*<td>(.*?)<\/td>', description)
        if match:
            business_name = match.group(1).strip()

        # Exclude features with NA/NIL, empty BUSINESS_NAME, or BUSINESS_NAME as '-'
        if not has_na_or_nil and business_name not in ["", "-"]:
            filtered_features.append(feature)

    # Update the JSON structure with the filtered features
    data["features"] = filtered_features

    # Save the cleaned data to the output file
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=4)

    print(f"Filtered JSON saved to {output_file}")


# Usage example
input_file = "EatingEstablishments.geojson"  # Replace with your input JSON file path
output_file = "FilteredEatingEstablishments.geojson"  # Replace with your desired output file path
drop_features_with_invalid_business_name(input_file, output_file)
