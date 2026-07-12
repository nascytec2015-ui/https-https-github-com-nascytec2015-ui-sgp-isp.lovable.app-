import { useState } from "react";


type Toast = {
    id: string;
    title?: string;
    description?: string;
};


export function useToast() {


    const [toasts, setToasts] = useState<Toast[]>([]);



    function toast(data: Omit<Toast, "id">) {


        const id =
            crypto.randomUUID();



        setToasts(prev => [

            ...prev,

            {
                id,
                ...data
            }

        ]);



        setTimeout(() => {


            setToasts(prev =>
                prev.filter(
                    t => t.id !== id
                )
            );


        }, 3000);


    }



    return {

        toast,

        toasts

    };

}