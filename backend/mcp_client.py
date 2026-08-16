import json, sys
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
SERVER=Path(__file__).resolve().parents[1]/'mcp'/'server.py'

async def call_tool(name:str,args:dict):
    params=StdioServerParameters(command=sys.executable,args=[str(SERVER)])
    async with stdio_client(params) as (read,write):
        async with ClientSession(read,write) as session:
            await session.initialize()
            result=await session.call_tool(name,args)
            texts=[c.text for c in result.content if hasattr(c,'text')]
            payload='\n'.join(texts)
            try:return json.loads(payload)
            except Exception:return {'raw':payload,'source':'park4night_mcp'}

async def list_tools():
    params=StdioServerParameters(command=sys.executable,args=[str(SERVER)])
    async with stdio_client(params) as (read,write):
        async with ClientSession(read,write) as session:
            await session.initialize();r=await session.list_tools()
            return [t.name for t in r.tools]
