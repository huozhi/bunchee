export class Bar {
  method() {
    const getResource = () => {
      return {
        [Symbol.dispose]: () => {
          console.log('Hooray!')
        },
      }
    }

    using resource = getResource()
    console.log('using resource', resource)
  }
}
