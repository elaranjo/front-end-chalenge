// Adapted from https://ui.shadcn.com/r/styles/new-york-v4/slider.json
"use client"

import * as React from "react"
import { cn } from "cn"
import { Slider as SliderPrimitive } from "radix-ui"

function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  ...props
}: React.ComponentProps<typeof SliderPrimitive.Root>) {
  const _values = React.useMemo(
    () =>
      Array.isArray(value)
        ? value
        : Array.isArray(defaultValue)
          ? defaultValue
          : [min, max],
    [value, defaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      className={cn("catalog-price-slider", className)}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="catalog-price-track"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="catalog-price-range"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          aria-label={index === 0 ? "Ajustar preço mínimo em ETH" : "Ajustar preço máximo em ETH"}
          className="catalog-price-thumb"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
