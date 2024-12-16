import { AtomicError } from './error.js';
import { isArray } from './index.js';
import { server } from './ontologies/server.js';
import { Resource, unknownSubject } from './resource.js';
import type { JSONObject, JSONValue } from './value.js';

/** Resources in JSON-AD can be referenced by their URL (string),
 * be entire (nested) resources, in which case they are JSONObjects */
type StringOrNestedResource = string | JSONObject;

export class JSONADParser {
  private parsedResources: Resource[] = [];

  /**
   * Parses an JSON-AD object containing a resource. Returns the resource and a list of all the sub-resources it found.
   */
  public parseObject(
    jsonObject: JSONObject,
    resourceSubject?: string,
  ): [parsedRootResource: Resource, allParsedResources: Resource[]] {
    this.parsedResources = [];
    const parsedResource = this.parseJsonADResource(
      jsonObject,
      resourceSubject,
    );

    return [parsedResource, [...this.parsedResources]];
  }

  /**
   * Parses an array of JSON-AD objects containing resources.
   * Returns a list of the resources in the array and a list of all the resources that were found including sub-resources.
   */
  public parseArray(
    jsonArray: unknown[],
  ): [resourcesInArray: Resource[], allParsedResources: Resource[]] {
    this.parsedResources = [];
    const resources = this.parseJsonADArray(jsonArray);

    return [resources, [...this.parsedResources]];
  }

  public parseValue(
    value: JSONValue,
    key: string,
  ): [value: JSONValue, allParsedResources: Resource[]] {
    this.parsedResources = [];
    const result = this.parseJsonAdResourceValue(value, key);

    return [result, [...this.parsedResources]];
  }

  private parseJsonADResource(
    object: JSONObject,
    resourceSubject: string = unknownSubject,
  ): Resource {
    const resource = new Resource(resourceSubject);
    this.parsedResources.push(resource);

    try {
      for (const [key, value] of Object.entries(object)) {
        if (key === '@id') {
          if (typeof value !== 'string') {
            throw new Error("'@id' field must be a string");
          }

          if (
            resource.subject !== 'undefined' &&
            resource.subject !== unknownSubject &&
            value !== resource.subject
          ) {
            throw new Error(
              `Resource has wrong subject in @id. Received subject was ${value}, expected ${resource.subject}.`,
            );
          }

          resource.setSubject(value);
          continue;
        }

        try {
          // Resource values can be either strings (URLs) or full Resources, which in turn can be either Anonymous (no @id) or Named (with an @id)
          if (isArray(value)) {
            const newarr = value.map(val =>
              this.parseJsonAdResourceValue(val, key),
            );
            resource.setUnsafe(key, newarr);
          } else if (typeof value === 'string') {
            resource.setUnsafe(key, value);
          } else if (typeof value === 'number') {
            resource.setUnsafe(key, value);
          } else if (typeof value === 'boolean') {
            resource.setUnsafe(key, value);
          } else {
            const subject = this.parseJsonAdResourceValue(value, key);
            resource.setUnsafe(key, subject);
          }
        } catch (e) {
          const baseMsg = `Failed creating value ${value} for key ${key} in resource ${resource.subject}`;
          const errorMsg = `${baseMsg}. ${e.message}`;
          throw new Error(errorMsg);
        }
      }

      resource.loading = false;

      if (resource.hasClasses(server.classes.error)) {
        resource.error = AtomicError.fromResource(resource);
      }
    } catch (e) {
      e.message = 'Failed parsing JSON ' + e.message;
      resource.setError(e);
      resource.loading = false;

      throw e;
    }

    return resource;
  }

  private parseJsonAdResourceValue(
    value: JSONValue,
    key: string,
  ): StringOrNestedResource {
    if (typeof value === 'string') {
      return value;
    }

    if (isJSONObject(value)) {
      if ('@id' in value) {
        // It's a named resource that should be parsed too
        const nestedSubject = value['@id'] as string;
        this.parseJsonADResource(value);

        return nestedSubject;
      } else {
        // It's an anonymous nested Resource
        return value;
      }
    }

    throw new Error(
      `Value ${value} in ${key} not a string or a nested Resource`,
    );
  }

  /** Parses a JSON-AD array, returns array of Resources */
  private parseJsonADArray(jsonArray: unknown[]): Resource[] {
    const resources: Resource[] = [];

    try {
      for (const jsonObject of jsonArray) {
        const resource = this.parseJsonADResource(jsonObject as JSONObject);
        resources.push(resource);
      }
    } catch (e) {
      e.message = 'Failed parsing JSON ' + e.message;
      throw e;
    }

    return resources;
  }
}

const isJSONObject = (value: JSONValue): value is JSONObject =>
  typeof value === 'object' && value !== null && !isArray(value);
