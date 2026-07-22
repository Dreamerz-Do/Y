<script setup lang="ts">
import { computed } from 'vue'
import { memberColorCss } from '@/shared/lib/palette'

// Member colour channel (spec 7.3): a small, consistent avatar. The initial is
// always present, so meaning never rides on colour alone (hard rule 6).
const props = withDefaults(
  defineProps<{
    initial: string
    hue: number
    name?: string
    size?: number
  }>(),
  { size: 40, name: '' },
)

const style = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  background: memberColorCss(props.hue),
  fontSize: `${Math.round(props.size * 0.4)}px`,
}))

const label = computed(() => props.name || props.initial)
</script>

<template>
  <div
    class="flex shrink-0 items-center justify-center rounded-full font-medium text-white"
    :style="style"
    :aria-label="label"
    role="img"
  >
    {{ initial }}
  </div>
</template>
