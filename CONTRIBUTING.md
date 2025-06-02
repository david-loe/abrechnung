# CONTRIBUTING.md

## Deutsch

### 1. CLA unterschreiben

Akzeptiere die [Contributor License Agreement](https://erp.david-loe.de/cla), damit Dein Beitrag angenommen werden kann.

### 2. Setup pre-commit lint (linux/macOS)

Im Projekt-Root-Ordner (`abrechnung`) ausführen:

```sh
ln -sf ../../dev-tools/biome/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### 3. Beitrag einreichen

1. Forke das Repository und erstelle einen Branch:
   ```bash
   git checkout -b feature/mein-feature
   ```
2. Push den Branch und öffne einen Pull Request gegen `main`.

---

## English

### 1. Sign the CLA

Accept the [Contributor License Agreement](https://erp.david-loe.de/cla) to ensure your contributions can be accepted.

### 2. Setup pre-commit lint (linux/macOS)

Run in the project root (`abrechnung`):

```sh
ln -sf ../../dev-tools/biome/pre-commit .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### 3. Submitting Contributions

1. Fork the repo and create a branch:
   ```bash
   git checkout -b feature/my-feature
   ```
2. Push your branch and open a Pull Request against `main`.
