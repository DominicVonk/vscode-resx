import { readResources, Resource } from './resources';

export interface ResourceDiff {
    key: string;
    status: 'added' | 'removed' | 'changed' | 'unchanged';
    before?: Resource;
    after?: Resource;
}
export function diffResources(before: string, after: string): ResourceDiff[] {
    const oldResources = new Map(readResources(before).map(resource => [resource.key, resource]));
    const newResources = new Map(readResources(after).map(resource => [resource.key, resource]));
    return Array.from(new Set([...oldResources.keys(), ...newResources.keys()])).sort().map(key => {
        const oldResource = oldResources.get(key);
        const newResource = newResources.get(key);
        const status = !oldResource ? 'added' : !newResource ? 'removed' :
            oldResource.value !== newResource.value || oldResource.comment !== newResource.comment ||
            oldResource.editable !== newResource.editable ? 'changed' : 'unchanged';
        return { key, status, before: oldResource, after: newResource };
    });
}
