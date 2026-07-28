/** Transport-neutral records for author-owned local materials. */
export interface Material {
    id: string;
    name: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}


export interface CreateMaterialInput {
    id?: string;
    name: string;
    content: string;
}


export interface UpdateMaterialInput {
    name?: string;
    content?: string;
}
