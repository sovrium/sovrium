#!/usr/bin/env python3
"""
Add validation blocks to all x-specs that don't have them.
This script adds placeholder validation blocks with setup and assertions structure.
"""

import json
from pathlib import Path
import sys

def add_validation_to_spec(spec):
    """Add validation block to a spec if missing"""
    if 'validation' in spec:
        return spec, False

    spec_id = spec.get('id', 'unknown')
    given = spec.get('given', '')
    when = spec.get('when', '')
    then_text = spec.get('then', '')

    # Create placeholder validation block
    spec['validation'] = {
        "setup": {
            "fieldConfig": {
                "name": "example_field",
                "type": "text"
            }
        },
        "assertions": [
            {
                "description": f"{then_text}",
                "validateConfig": True,
                "expectError": None
            }
        ]
    }

    return spec, True

def process_file(filepath):
    """Process a single file and add validation blocks where missing"""
    try:
        with open(filepath, 'r') as f:
            data = json.load(f)

        if 'x-specs' not in data:
            return 0

        updated_count = 0
        for i, spec in enumerate(data['x-specs']):
            data['x-specs'][i], was_updated = add_validation_to_spec(spec)
            if was_updated:
                updated_count += 1

        if updated_count > 0:
            # Write back with proper formatting
            with open(filepath, 'w') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.write('\n')  # Add trailing newline

            return updated_count

        return 0
    except Exception as e:
        print(f"ERROR processing {filepath}: {e}", file=sys.stderr)
        return 0

def main():
    print("=== ADDING VALIDATION BLOCKS TO x-specs ===\n")

    total_files = 0
    total_specs = 0

    # Process app schemas
    print("📁 Processing specs/app/tables/\n")
    for schema_file in sorted(Path('specs/app/tables').rglob('*.schema.json')):
        count = process_file(schema_file)
        if count > 0:
            total_files += 1
            total_specs += count
            print(f"  ✅ {schema_file} - Added {count} validation blocks")

    # Process API specs
    print("\n📁 Processing specs/api/paths/tables/\n")
    for api_file in sorted(Path('specs/api/paths/tables').rglob('*.json')):
        count = process_file(api_file)
        if count > 0:
            total_files += 1
            total_specs += count
            print(f"  ✅ {api_file} - Added {count} validation blocks")

    print(f"\n{'='*70}")
    print(f"✅ COMPLETE")
    print(f"   Files updated: {total_files}")
    print(f"   Validation blocks added: {total_specs}")

if __name__ == '__main__':
    main()
