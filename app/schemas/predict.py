from pydantic import BaseModel, Field


class PredictIn(BaseModel):
    image: str = Field(description="data:image/png;base64,... of the whole canvas")
    topk: int = Field(3, ge=1, le=10)
    mode: str = "auto"              # "auto" | "letters" | "digits"


class Candidate(BaseModel):
    label: str
    prob: float


class PredictOut(BaseModel):
    empty: bool
    label: str | None
    candidates: list[Candidate]
    preview: list[list[int]] | None   # the 28x28 the model saw, 0..255
    ms: float
    timings: dict[str, float] = Field(default_factory=dict, description="Server-side durations in milliseconds")
