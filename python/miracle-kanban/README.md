# Miracle kanban

## Intall：

### Ensure to use Python version: 3.10.11

### Enter the root directory of Kanban code
```bash
cd python
cd miracle-kanban
```
### Create a virtual environment (at first run)
```bash
python -m venv kanban_env
```
### Activate virtual environment
Windows system running this line:
```bash
kanban_env\Scripts\activate  #running scripts is disabled on this system :run -->>> Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
Running this line on Linux/Mac systems:
```
source kanban_env/bin/activate
```

### Installing dependencies in a virtual environment (at first run)
```bash
(kanban_env) pip install PyQt5==5.15.11
(kanban_env) pip install PyQtWebEngine==5.15.7
(kanban_env) pip install websockets==15.0.1
(kanban_env) pip install cryptography==46.0.2
(kanban_env) pip install aiohttp==3.13.2
```

## Configuration：

1.chinese chess server config

```bash
(kanban_env) cd backend
(kanban_env) cd chineseChess
(kanban_env) cp configure.py.example.py configure.py
(kanban_env) vim configure.py
```

2.chinese chess server RSA key pair

```bash
(kanban_env) cd backend
(kanban_env) cd chineseChess
(kanban_env) cp RSAKEYPAIR.py.example.py RSAKEYPAIR.py
(kanban_env) vim RSAKEYPAIR.py
```

3.account server config

```bash
(kanban_env) cd backend
(kanban_env) cd accountServer
(kanban_env) cp configure.py.example.py configure.py
(kanban_env) vim configure.py
```

### Run the program
```bash
(kanban_env) pwd # Confirm in the project root directory
(kanban_env) python main.py
```