export type TabItem = {
    id: string;
    name: string;
    //FIXME: cambiar a obligatorio cuando arregle el bug de aria-hidden
    icon?: React.ReactNode;
    component: React.ReactNode;
};
