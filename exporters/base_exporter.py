"""Base exporter interface."""
from abc import ABC, abstractmethod
from typing import Any

class BaseExporter(ABC):
    @abstractmethod
    def export(self, annotations: list, output_path: str, **kwargs) -> str:
        """Export annotations to a file. Returns the output path."""
        ...

    def validate(self, annotations: list) -> bool:
        return len(annotations) > 0
