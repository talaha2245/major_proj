from langchain_community.utilities import ArxivAPIWrapper
from langchain_community.tools.arxiv.tool import ArxivQueryRun

# my name is arxiv_tool, but you can call me whatever you like

arxiv_tool = ArxivQueryRun(api_wrapper=ArxivAPIWrapper())
