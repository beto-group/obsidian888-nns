import os

# ======= CONFIGURATION =======
INCLUDE_FILES = [
    "main.ts",
    "src",
    "util"
]
OUTPUT_FILE = "code_dump.txt"
FILE_EXTENSIONS = [".ts", ".js", ".py", ".html", ".css"]
# =============================

def is_code_file(filename):
    return any(filename.endswith(ext) for ext in FILE_EXTENSIONS)

def collect_selected_files(include_list):
    result_files = []

    for item in include_list:
        if os.path.isfile(item) and is_code_file(item):
            result_files.append(os.path.abspath(item))

        elif os.path.isdir(item):
            for root, _, files in os.walk(item):
                for file in files:
                    if is_code_file(file):
                        result_files.append(os.path.abspath(os.path.join(root, file)))

    return result_files

def write_combined_code(files, output_path):
    with open(output_path, "w", encoding="utf-8") as out_file:
        for file_path in files:
            rel_path = os.path.relpath(file_path, start=os.getcwd())
            out_file.write(f"\n===== {rel_path} =====\n\n")
            try:
                with open(file_path, "r", encoding="utf-8") as in_file:
                    out_file.write(in_file.read())
            except Exception as e:
                out_file.write(f"[Error reading file: {e}]\n")

if __name__ == "__main__":
    selected_files = collect_selected_files(INCLUDE_FILES)
    write_combined_code(selected_files, OUTPUT_FILE)
    print(f"✅ Dumped {len(selected_files)} files into {OUTPUT_FILE}")
