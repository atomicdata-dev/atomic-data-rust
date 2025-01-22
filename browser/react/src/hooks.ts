import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useContext,
  createContext,
  useRef,
} from 'react';
import {
  Property,
  Store,
  Resource,
  Datatype,
  datatypeFromUrl,
  truncateUrl,
  JSONValue,
  valToBoolean,
  valToNumber,
  valToDate,
  valToArray,
  valToString,
  FetchOpts,
  unknownSubject,
  JSONArray,
  OptionalClass,
  proxyResource,
  type Core,
  ResourceEvents,
  core,
  server,
} from '@tomic/lib';

/**
 * Hook for getting a Resource in a React component. Will try to fetch the
 * subject and add its parsed values to the store.
 */
export function useResource<C extends OptionalClass = never>(
  subject: string = unknownSubject,
  opts?: FetchOpts,
): Resource<C> {
  const store = useStore();
  const [resource, setResource] = useState<Resource<C>>(() =>
    store.getResourceLoading(subject, opts),
  );

  // If the subject changes, make sure to change the resource!
  // When a component mounts, it needs to let the store know that it will subscribe to changes to that resource.
  useEffect(() => {
    setResource(proxyResource(store.getResourceLoading(subject, opts)));

    return store.subscribe(subject, (updated: Resource<C>) => {
      setResource(proxyResource(updated));
    });
  }, [store, subject]);

  useEffect(() => {
    return resource.on(ResourceEvents.LocalChange, () => {
      setResource(proxyResource(resource.__internalObject));
    });
  }, [store]);

  return resource;
}

const stableEmptyArray: string[] = [];

/**
 * Converts an array of Atomic URL strings to an array of Resources.
 * !! Make sure the array is stable by memoizing it !!
 */
export function useResources(
  subjects: string[] | undefined = stableEmptyArray,
  opts: FetchOpts = {},
): Map<string, Resource> {
  const [resources, setResources] = useState(new Map<string, Resource>());
  const store = useStore();

  useEffect(() => {
    // When a change happens, set the new Resource.
    function handleNotify(updated: Resource) {
      setResources(prev => {
        prev.set(updated.subject, proxyResource(updated));

        // We need to create new Maps for react hooks to update - React only checks references, not content
        return new Map(prev);
      });
    }

    setResources(prev => {
      for (const subject of subjects) {
        const resource = store.getResourceLoading(subject, opts);
        prev.set(subject, proxyResource(resource));

        // Let the store know to call handleNotify when a resource is updated.
        store.subscribe(subject, handleNotify);
      }

      return new Map(prev);
    });

    return () => {
      // When the component is unmounted, unsubscribe from the store.
      for (const subject of subjects) {
        store.unsubscribe(subject, handleNotify);
      }
    };
    // maybe add resources here
  }, [subjects, store]);

  return resources;
}

/**
 * Hook for using a Property. Will return `undefined` if the Property is not yet
 * loaded, and add Error strings to shortname and description if something goes wrong.
 */
export function useProperty(subject: string): Property {
  const resource = useResource<Core.Property>(subject);

  const property: Property = useMemo(() => {
    if (resource.loading) {
      return {
        subject,
        datatype: Datatype.UNKNOWN,
        shortname: 'loading',
        description: `Loading property ${subject}`,
        loading: true,
      };
    }

    if (resource.error) {
      return {
        subject,
        datatype: Datatype.UNKNOWN,
        shortname: 'error',
        description: 'Error getting Property. ' + resource.error.message,
        error: resource.error,
      };
    }

    return {
      subject,
      datatype: datatypeFromUrl(resource.props.datatype),
      shortname: resource.props.shortname,
      description: resource.props.description,
      classType: resource.props.classtype,
      isDynamic: !!resource.props.isDynamic,
      allowsOnly: resource.props.allowsOnly,
    };
  }, [resource]);

  return property;
}

export type SetValue<T extends JSONValue = JSONValue> = (
  val: T | undefined,
) => Promise<void>;

/** Extra options for useValue hooks, mostly related to commits and validation */
type useValueOptions = {
  /**
   * Sends a Commit to the server when the value is changed. Disabled by
   * default. If this is false, you will need to manually call Resource.save()
   * to save changes
   */
  commit?: boolean;
  /**
   * Performs datatype validation. Enabled by default, but this could cause some
   * slowdown when the first validation is done as the Property needs to be
   * present in the store, and might have to be fetched
   */
  validate?: boolean;
  /** Amount of milliseconds to wait (debounce) before applying Commit. Defaults to 100. */
  commitDebounce?: number;
  /**
   * A callback function that will be called when the validation fails. For
   * example, pass a `setError` function. If you want to remove the Error, return `undefined`.
   */
  handleValidationError?: (e: Error | undefined) => unknown;
};

/**
 * Similar to React's `useState` hook. Returns a Value and a Setter as an array
 * of two items. Value will be `undefined` if the Resource isn't loaded yet. The
 * generated Setter function can be called to set the value. Be sure to look at
 * the various options for useValueOptions (debounce, commits, error handling).
 *
 * ```typescript
 * // Simple usage:
 * const resource = useResource('https://atomicdata.dev/classes/Agent');
 * const [shortname, setShortname] = useValue(
 *   resource,
 *   'https://atomicdata.dev/properties/shortname',
 * );
 * ```
 *
 * ```typescript
 * // With options:
 * const resource = useResource('https://atomicdata.dev/classes/Agent');
 * const [error, setError] = useState(null);
 * const [shortname, setShortname] = useValue(
 *   resource,
 *   'https://atomicdata.dev/properties/shortname',
 *   {
 *     commit: true,
 *     validate: true,
 *     commitDebounce: 500,
 *     handleValidationError: setError,
 *   },
 * );
 * ```
 */
export function useValue(
  resource: Resource,
  propertyURL: string,
  opts: useValueOptions = {},
): [JSONValue | undefined, SetValue] {
  const timeoutId = useRef<ReturnType<typeof setTimeout>>(undefined);
  const {
    commit = false,
    validate = true,
    commitDebounce = 100,
    handleValidationError,
  } = opts;

  const [val, set] = useState<JSONValue>(resource.get(propertyURL));
  const [prevResourceReference, setPrevResourceReference] = useState(resource);

  const store = useStore();

  const saveResource = useCallback(() => {
    if (!commit) {
      return;
    }

    if (timeoutId.current !== undefined) {
      clearTimeout(timeoutId.current);
    }

    timeoutId.current = setTimeout(async () => {
      try {
        await resource.save();
      } catch (e) {
        store.notifyError(e);
      }
    }, commitDebounce);
  }, [resource, store, commitDebounce, commit]);

  /**
   * Validates the value. If it fails, it calls the function in the second
   * Argument. Pass `undefined` to remove existing value.
   */
  const validateAndSet = useCallback(
    async (newVal: JSONValue): Promise<void> => {
      if (newVal === undefined) {
        // remove the value
        resource.remove(propertyURL);
        set(undefined);
        saveResource();

        return;
      }

      set(newVal);

      // Validates and sets a property / value combination. Will invoke the
      // callback if the value is not valid.
      try {
        await resource.set(propertyURL, newVal, validate);
        saveResource();
        handleValidationError?.(undefined);
      } catch (e) {
        if (handleValidationError) {
          handleValidationError(e);
        } else {
          store.notifyError(e);
        }
      }
    },
    [resource, handleValidationError, store, validate, saveResource],
  );

  useEffect(() => {
    return resource.on(ResourceEvents.LocalChange, (prop, value) => {
      if (prop === propertyURL) {
        set(value);
      }
    });
  }, [resource, propertyURL]);

  // Update value when resource changes.
  if (resource !== prevResourceReference) {
    let localVal: JSONValue | undefined;

    try {
      localVal = resource.get(propertyURL);
      set(localVal);
    } catch (e) {
      store.notifyError(e);
    }

    setPrevResourceReference(resource);

    // We changed the value but we don't want to wait a whole react cycle to return the new value so we return the value here directly.
    return [localVal, validateAndSet];
  }

  return [val, validateAndSet];
}

/**
 * Hook for getting and setting a stringified representation of an Atom in a
 * React component. See {@link useValue}
 */
export function useString(
  resource: Resource,
  propertyURL: string,
  opts?: useValueOptions,
): [string | undefined, SetValue<string>] {
  const [val, setVal] = useValue(resource, propertyURL, opts);

  if (typeof val === 'string') {
    return [val, setVal];
  }

  if (val === undefined) {
    return [undefined, setVal];
  }

  return [valToString(val), setVal];
}

export const noNestedSupport =
  'error:no_support_for_editing_nested_resources_yet';

/**
 * Hook for getting and setting a Subject. Converts Nested resources into paths.
 * See {@link useValue} for more info on using the `set` functionality.
 */
export function useSubject(
  resource: Resource,
  propertyURL: string,
  opts?: useValueOptions,
): [string | undefined, SetValue<string>] {
  const [val, setVal] = useValue(resource, propertyURL, opts);

  if (!val) {
    return [undefined, setVal];
  }

  if (typeof val === 'string') {
    return [val, setVal];
  } else {
    // It's a nested resource
    // TODO: Implement support for this. Get the subject from the Resource, or construct te Path.
    return [noNestedSupport, setVal];
  }
}

const titleHookOpts: useValueOptions = {
  commit: true,
};

/**
 * Returns the most fitting title / name for a Resource. This is either the
 * Name, Shortname, Filename or truncated Subject URL of that resource.
 */
export function useTitle(
  resource: Resource,
  truncateLength = 40,
  opts: useValueOptions = titleHookOpts,
): [string, SetValue<string>] {
  const [name, setName] = useString(resource, core.properties.name, opts);
  const [shortname, setShortname] = useString(
    resource,
    core.properties.shortname,
    opts,
  );
  const [filename, setFileName] = useString(
    resource,
    server.properties.filename,
    opts,
  );

  if (resource.loading) {
    return ['...', setName];
  }

  if (name !== undefined) {
    return [name, setName];
  }

  if (shortname !== undefined) {
    return [shortname, setShortname];
  }

  if (filename !== undefined) {
    return [filename, setFileName];
  }

  const subject = resource?.subject;

  if (typeof subject === 'string' && subject.length > 0) {
    return [truncateUrl(subject, truncateLength), setName];
  }

  return [subject, setName];
}

/**
 * Hook for getting all URLs for some array. Returns the current Array (defaults
 * to empty array) and a callback for validation errors. See {@link useValue}
 */
export function useArray(
  resource: Resource,
  propertyURL: string,
  opts?: useValueOptions,
): [string[], SetValue<JSONArray>, (vals: string[]) => void] {
  const [value, set] = useValue(resource, propertyURL, opts);
  const [stableEmptyResourceArray] = useState<JSONArray>([]);

  const values = useMemo(() => {
    if (value === undefined) {
      return stableEmptyResourceArray;
    }

    try {
      // This cast isn't entirely correct - we should add a `useSubjects` hook.
      // https://github.com/atomicdata-dev/atomic-data-browser/issues/219
      return valToArray(value);
    } catch (e) {
      console.error(e, value, propertyURL, resource.subject);

      // If .toArray() errors, return an empty array. Useful in forms when datatypes haves changed!
      // https://github.com/atomicdata-dev/atomic-data-browser/issues/85
      return stableEmptyResourceArray;
    }
  }, [value, resource, propertyURL]);

  const push = useCallback(
    (val: string[]) => {
      resource.push(propertyURL, val);

      if (opts?.commit) {
        resource.save();
      }
    },
    [resource, propertyURL],
  );

  return [values as string[], set, push];
}

/** See {@link useValue} */
export function useNumber(
  resource: Resource,
  propertyURL: string,
  opts?: useValueOptions,
): [number | undefined, SetValue<number>] {
  const [value, set] = useValue(resource, propertyURL, opts);

  if (value === undefined) {
    return [undefined, set];
  }

  return [valToNumber(value), set];
}

/** Returns false if there is no value for this propertyURL. See {@link useValue} */
export function useBoolean(
  resource: Resource,
  propertyURL: string,
  opts?: useValueOptions,
): [boolean, SetValue<boolean>] {
  const [value, set] = useValue(resource, propertyURL, opts);

  useEffect(() => {
    if (value === undefined) {
      set(false);
    }
  }, [value, set]);

  if (value === undefined) {
    return [false, set];
  }

  return [valToBoolean(value), set];
}

/**
 * Hook for getting a stringified representation of an Atom in a React
 * component. See {@link useValue}
 */
export function useDate(
  resource: Resource,
  propertyURL: string,
  opts?: useValueOptions,
): Date | undefined {
  const store = useStore();
  const [value] = useValue(resource, propertyURL, opts);

  if (value === undefined) {
    return undefined;
  }

  try {
    return valToDate(value);
  } catch (e) {
    store.notifyError(e);

    return;
  }
}

/** Preferred way of using the store in a Component or Hook */
export function useStore(): Store {
  const store = useContext(StoreContext);

  if (store === undefined) {
    throw new Error(
      'Store is not found in react context. Have you wrapped your application in `<StoreContext.Provider value={new Store}>`?',
    );
  }

  return store;
}

/**
 * Checks if the current agent has the appropriate rights to edit this resource.
 */
export function useCanWrite(resource: Resource): boolean {
  const store = useStore();
  const [canWrite, setCanWrite] = useState<boolean>(false);
  const agent = store.getAgent();

  // If the subject changes, make sure to change the resource!
  useEffect(() => {
    if (!agent) {
      setCanWrite(false);

      return;
    }

    if (resource.new) {
      setCanWrite(true);

      return;
    }

    resource.canWrite(agent.subject).then(([result]) => {
      setCanWrite(result);
    });
  }, [resource, agent?.subject]);

  return canWrite;
}

/**
 * The context must be provided by wrapping a high level React element in
 * `<StoreContext.Provider value={new Store}>My App</StoreContext.Provider>`
 */
export const StoreContext = createContext<Store>(new Store());
