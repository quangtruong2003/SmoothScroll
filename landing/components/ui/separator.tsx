'use client'

import * as React from 'react'
import * as SeparatorPrimitives from '@radix-ui/react-separator'
import { cn } from '@/lib/utils'

const Separator = React.forwardRef<
  React.ElementRef<typeof SeparatorPrimitives.Root>,
  React.ComponentPropsWithoutRef<typeof SeparatorPrimitives.Root>
>(
  (
    { className, orientation = 'horizontal', decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitives.Root
      ref={ref}
      decorative={decorative}
      orientation={orientation}
      className={cn(
        'shrink-0 bg-border',
        orientation === 'horizontal' ? 'h-[1px] w-full' : 'h-full w-[1px]',
        className
      )}
      {...props}
    />
  )
)
Separator.displayName = SeparatorPrimitives.Root.displayName

export { Separator }
