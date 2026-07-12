import { useState } from "react";


type ToastVariant =
    | "default"
    | "destructive";



type Toast = {

    id: string;

    title?: string;

    description?: string;

    variant?: ToastVariant;

};





const listeners: Array<
    (toast: Toast) => void
> = [];





export function toast(
    data: Omit<Toast, "id">
) {


    const id =
        crypto.randomUUID();



    const newToast = {

        id,

        ...data

    };



    listeners.forEach(
        listener =>
            listener(newToast)
    );



}






export function useToast() {


    const [toasts, setToasts] =
        useState<Toast[]>([]);





    if (!listeners.includes(setToasts as any)) {


        listeners.push(
            setToasts as any
        );


    }






    function dismiss(id: string) {


        setToasts(prev =>

            prev.filter(
                toast =>
                    toast.id !== id
            )

        );


    }







    return {


        toast,


        toasts,


        dismiss


    };

}