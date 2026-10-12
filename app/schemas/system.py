from pydantic import BaseModel


class InfoOut(BaseModel):
    unified: bool                       # True when a single 36-class model is loaded
    classes: dict[str, list[str]]       # per loaded model
    all: list[str]                      # every valid label
