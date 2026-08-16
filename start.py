import webbrowser, threading, uvicorn
threading.Timer(1.2,lambda:webbrowser.open('http://127.0.0.1:8080')).start()
uvicorn.run('backend.app:app',host='127.0.0.1',port=8080,reload=False)
