export const log = {
  debug:
    process.env.DEBUG === "1"
      ? (msg: string, ...optionalParams: unknown[]) => {
          console.log(msg, ...optionalParams);
        }
      : // eslint-disable-next-line @typescript-eslint/no-empty-function
        (_msg: string, ..._optionalParams: unknown[]) => {},
  error: (msg: string, ...optionalParams: unknown[]) => {
    console.error(msg, ...optionalParams);
  },
};
