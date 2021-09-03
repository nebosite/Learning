
export const doNothing = (msDelay: number) => {
    return new Promise<void>(resolve => { setTimeout(()=> resolve(), msDelay) })
}