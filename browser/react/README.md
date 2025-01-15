# @tomic/react: The Atomic Data library for React

A library for viewing and creating Atomic Data.
Re-exports `@tomic/lib`.

[**docs**](https://docs.atomicdata.dev/usecases/react)

[**demo + template on codesandbox**!](https://codesandbox.io/s/atomic-data-react-template-4y9qu?file=/src/MyResource.tsx:0-1223)

## Setup

When initializing your App, initialize the store, which will contain all data.
Wrap your App in a `StoreContext.Provider`, and pass the newly initialized store to it.

```ts
// App.tsx
import { StoreContext, Store } from "@tomic/react";

// The store contains all the data for
const store = new Store({
  serverUrl: 'https://my-atomic-server.com',
});

export default function App() {
  return (
    <StoreContext.Provider value={store}>
      // The rest of your app
    </StoreContext.Provider>
  );
}
```

Now, your Store can be accessed in React's context allowing you to use our hooks!

## Hooks

```tsx
import { useResource, useString, core } from "@tomic/react";

const SomeComponent = () => {
  // Get the Resouce, and all its properties
  const resource = useResource('https://atomicdata.dev/classes/Agent');
  // All useValue / useString / useArray / useBoolean hooks have a getter and a setter.
  const [description, setDescription] = useString(resource, core.properties.description);

  return (
    <>
      <h1>{resource.title}</h2>
      <textarea value={description} onChange={e => setDescription(e.target.value)} />
      <button type={button} onClick={resource.save}>Save & commit</button>
    </>
  )
}

```

There are a lot more hooks and helpers available.
See the [docs](https://docs.atomicdata.dev/usecases/react) for more information.
