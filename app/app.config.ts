export default defineAppConfig({
  ui: {
    dropdownMenu: {
      slots: {
        item: 'items-center'
      }
    },
    tooltip: {
      slots: {
        text: 'max-w-96 text-ellipsis h-auto',
        content: 'h-auto'
      }
    }
  }
})
