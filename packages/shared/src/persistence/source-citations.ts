export interface SourceCitation {
    id: string;
    editorialArtifactId?: string;
    url: string;
    title?: string;
    excerpt?: string;
    uncertainty?: string;
    createdAt: string;
}


export interface CreateSourceCitationInput {
    id?: string;
    editorialArtifactId?: string;
    url: string;
    title?: string;
    excerpt?: string;
    uncertainty?: string;
}
