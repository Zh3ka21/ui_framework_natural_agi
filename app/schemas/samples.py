from pydantic import BaseModel


class SaveIn(BaseModel):
    image: str
    label: str          # confirmed by the user


class SaveOut(BaseModel):
    saved: str
