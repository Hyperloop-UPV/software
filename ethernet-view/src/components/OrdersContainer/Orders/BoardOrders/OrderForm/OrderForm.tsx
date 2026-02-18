import styles from './OrderForm.module.scss';
import { OrderDescription } from 'common';
import { Header, HeaderInfo } from './Header/Header';
import { Fields } from './Fields/Fields';
import { useContext, useState } from 'react';
import { Order } from 'common';
import { useForm } from './useForm';
import { useSpring } from '@react-spring/web';
import { useListenKey } from './useListenKey';
import { OrderContext } from '../../OrderContext';
import { FormField } from './form';

type Props = {
    description: OrderDescription;
};

function createOrder(id: number, fields: FormField[]): Order {
    return {
        id: id,
        fields: Object.fromEntries(
            fields.map((field) => {
                return [
                    field.id,
                    {
                        value: field.value,
                        isEnabled: field.isEnabled,
                        type: field.type,
                    },
                ];
            })
        ),
    };
}

export const OrderForm = ({ description }: Props) => {
    const sendOrder = useContext(OrderContext);
    const { form, updateField, changeEnable } = useForm(description.fields);
    const [isOpen, setIsOpen] = useState(false);
    const [springs, api] = useSpring(() => ({
        from: { filter: 'brightness(1)' },
        config: {
            tension: 600,
        },
    }));

    const trySendOrder = () => {
        if (form.isValid) {
            api.start({
                from: { filter: 'brightness(1.2)' },
                to: { filter: 'brightness(1)' },
            });

            sendOrder(createOrder(description.id, form.fields));
        }
    };

    const listen = useListenKey(' ', trySendOrder);

    const headerInfo: HeaderInfo =
        form.fields.length > 0
            ? {
                  type: 'toggable',
                  isOpen: isOpen,
                  toggleDropdown: () => setIsOpen((prevValue) => !prevValue),
              }
            : { type: 'fixed' };

    return (
        <div className={styles.orderFormWrapper}>
            <Header
                name={description.name}
                info={headerInfo}
                disabled={!form.isValid}
                onTargetClick={listen}
                onButtonClick={trySendOrder}
                springs={springs}
            />
            {isOpen && (
                <Fields
                    fields={form.fields}
                    updateField={updateField}
                    changeEnable={changeEnable}
                />
            )}
        </div>
    );
};
