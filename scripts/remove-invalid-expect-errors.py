#!/usr/bin/env python3
"""
Remove expectError from assertions that have expected values (success cases).
Only assertions expecting failures should have expectError.
"""

import json
from pathlib import Path

def fix_invalid_expect_errors(file_path):
    """Remove expectError from success assertions"""

    try:
        with open(file_path, 'r') as f:
            data = json.load(f)

        if 'x-specs' not in data:
            return 0

        fixes_count = 0

        for spec in data['x-specs']:
            if 'validation' not in spec:
                continue

            assertions = spec['validation'].get('assertions', [])
            for assertion in assertions:
                # If assertion has 'expected' field, it's a success case
                # Remove expectError if present
                if 'expected' in assertion and 'expectError' in assertion:
                    del assertion['expectError']
                    fixes_count += 1

        if fixes_count > 0:
            with open(file_path, 'w') as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
                f.write('\n')

        return fixes_count

    except Exception as e:
        print(f"Error processing {file_path}: {e}")
        return 0

def main():
    print("=== REMOVING INVALID expectError FROM SUCCESS ASSERTIONS ===\n")

    total_files = 0
    total_fixes = 0

    # Process all schema files
    for schema_file in sorted(Path('specs/app/tables').rglob('*.schema.json')):
        fixes = fix_invalid_expect_errors(schema_file)
        if fixes > 0:
            total_files += 1
            total_fixes += fixes
            print(f"✅ {schema_file} - Removed {fixes} invalid expectError")

    print(f"\n{'='*70}")
    print(f"✅ COMPLETE")
    print(f"   Files updated: {total_files}")
    print(f"   Invalid expectError removed: {total_fixes}")

if __name__ == '__main__':
    main()
