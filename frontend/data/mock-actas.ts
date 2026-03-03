import { Acta } from "@/types/acta";

export const MOCK_ACTAS: Acta[] = [
  {
    id: "a3",
    title: "Junta Ordinaria - Marzo 2024",
    date: "2024-03-12",
    executiveSummary:
      "Se celebró la Junta Ordinaria de Propietarios de la Comunidad Residencial Las Encinas con una asistencia récord del 91% de los propietarios, tanto en persona como por representación. La reunión, que se prolongó durante casi tres horas, abordó en profundidad la situación financiera de la comunidad tras el cierre del ejercicio 2023, el estado de las instalaciones comunes tras el invierno, la propuesta de instalación de paneles solares en la cubierta del edificio principal, la renovación del contrato de mantenimiento de ascensores, la regulación del uso del parking de visitas, y la actualización del reglamento interno de convivencia. El administrador de fincas, D. Ramón Fuentes, presentó un informe detallado sobre la morosidad, que se sitúa en el 4,2% del total de cuotas, y propuso un plan de pagos fraccionados para los deudores. Se aprobaron todas las propuestas sometidas a votación salvo la instalación de cámaras de vigilancia adicionales en el garaje, que quedó aplazada para recabar más presupuestos. El ambiente fue constructivo y participativo, con numerosas intervenciones de los vecinos.",
    agreements: [
      "Aprobación de las cuentas del ejercicio 2023 con superávit de 3.200€ por unanimidad.",
      "Aprobación del presupuesto ordinario 2024 por importe de 187.400€, con incremento del 4,5% respecto al ejercicio anterior, motivado por el aumento del coste energético y la subida del IPC.",
      "Aprobación de la instalación de placas solares fotovoltaicas en la cubierta del bloque A, con un presupuesto máximo de 42.000€, financiado mediante derrama extraordinaria de 280€ por vivienda en tres cuotas trimestrales.",
      "Renovación del contrato de mantenimiento de ascensores con la empresa Otis S.A. por un importe anual de 9.600€, con una rebaja del 8% respecto al contrato anterior.",
      "Aprobación del nuevo reglamento de uso del parking de visitas: máximo 48 horas consecutivas por vehículo, previa comunicación a la portería. Se habilita un sistema de reservas online.",
      "Constitución de una comisión de seguimiento de obras formada por tres propietarios voluntarios para supervisar la ejecución del proyecto solar.",
      "Aplazamiento de la instalación de cámaras adicionales en el garaje hasta la próxima junta, pendiente de recabar al menos tres presupuestos comparativos.",
      "Aprobación del plan de pagos fraccionados para propietarios con deudas inferiores a 600€: hasta seis mensualidades sin recargo.",
    ],
    topics: [
      "Situación financiera y cierre del ejercicio 2023",
      "Presupuesto ordinario 2024",
      "Proyecto de instalación de energía solar fotovoltaica",
      "Renovación de contrato de mantenimiento de ascensores",
      "Regulación del parking de visitas y nuevo sistema de reservas",
      "Actualización del reglamento interno de convivencia",
      "Plan de gestión de la morosidad",
      "Seguridad en zonas comunes: cámaras de vigilancia",
    ],
    tasks: [
      {
        responsible: "Administrador Ramón Fuentes",
        description:
          "Solicitar un mínimo de tres presupuestos a empresas instaladoras de placas solares homologadas y presentarlos a la comisión de seguimiento antes del 30 de abril de 2024.",
        deadline: "30/04/2024",
      },
      {
        responsible: "Comisión de seguimiento de obras (Sra. Martínez, Sr. López, Sra. Chen)",
        description:
          "Revisar y validar los presupuestos de instalación solar recibidos, elaborar un informe comparativo y remitirlo a todos los propietarios por correo electrónico.",
        deadline: "15/05/2024",
      },
      {
        responsible: "Portería / Empresa de gestión",
        description:
          "Implementar el sistema de reservas online para el parking de visitas e informar a todos los residentes del nuevo procedimiento mediante circular.",
        deadline: "01/04/2024",
      },
      {
        responsible: "Administrador Ramón Fuentes",
        description:
          "Contactar individualmente con los propietarios morosos para ofrecerles el plan de pagos fraccionados aprobado en junta y documentar los acuerdos alcanzados.",
        deadline: "15/04/2024",
      },
      {
        responsible: "Presidente D. Antonio Vega",
        description:
          "Formalizar la renovación del contrato con Otis S.A. con las condiciones aprobadas en junta y remitir copia firmada a todos los miembros de la junta directiva.",
        deadline: "20/03/2024",
      },
    ],
    transcript:
      "El presidente, D. Antonio Vega, abre la sesión a las 18:30 horas en el salón de actos de la comunidad. Se comprueba el quórum: están presentes o representados 41 de los 45 propietarios, lo que representa el 91,1% de las cuotas de participación. Se declara válidamente constituida la junta.\n\nEl secretario procede a la lectura y aprobación del acta de la junta anterior, que es aprobada por unanimidad sin observaciones.\n\nPUNTO 1 — APROBACIÓN DE CUENTAS 2023\nEl administrador D. Ramón Fuentes presenta el balance del ejercicio 2023. Los ingresos totales ascendieron a 183.200€ y los gastos a 180.000€, resultando un superávit de 3.200€ que se destinará al fondo de reserva. El propietario del piso 4B, Sr. Ortega, solicita aclaración sobre la partida de reparaciones extraordinarias por importe de 12.400€. El administrador explica que corresponde a la reparación urgente de la cubierta del bloque B tras las lluvias de octubre. Se somete a votación: 39 votos a favor, 0 en contra, 2 abstenciones. Aprobado.\n\nPUNTO 2 — PRESUPUESTO 2024\nEl administrador presenta el presupuesto ordinario para el ejercicio 2024 por importe de 187.400€, lo que supone un incremento del 4,5% respecto al año anterior. El incremento se justifica principalmente por el aumento del 12% en la tarifa eléctrica contratada para las zonas comunes y la actualización del coste de los seguros del edificio conforme al IPC. La Sra. Romero del piso 2A pregunta si se ha considerado renegociar el contrato de limpieza. El administrador indica que el contrato actual vence en junio y que se solicitarán nuevas ofertas. Se somete a votación: 38 votos a favor, 1 en contra (Sr. Morales, piso 7C), 2 abstenciones. Aprobado.\n\nPUNTO 3 — INSTALACIÓN DE ENERGÍA SOLAR FOTOVOLTAICA\nEl administrador presenta un estudio de viabilidad elaborado por la empresa SolarTech Iberia S.L. La instalación propuesta consta de 48 paneles fotovoltaicos en la cubierta del bloque A con una potencia instalada de 19,2 kWp. La inversión estimada es de 38.000-42.000€ con un período de retorno de 7 a 9 años. Se estima un ahorro anual en la factura eléctrica de las zonas comunes de entre 4.200€ y 5.100€. Varios propietarios intervienen: el Sr. López del 5A apoya la propuesta y ofrece formar parte de la comisión de seguimiento. La Sra. Chen del 3B expresa su respaldo pero solicita que se pidan al menos tres presupuestos antes de adjudicar. El Sr. Pérez del 8D pregunta por las subvenciones disponibles; el administrador confirma que existe una línea de ayudas del Plan de Recuperación que podría cubrir hasta el 30% de la inversión. Se aprueba la instalación con un presupuesto máximo de 42.000€ y se constituye la comisión de seguimiento. Votos: 37 a favor, 2 en contra, 2 abstenciones. Aprobado.\n\nPUNTO 4 — RENOVACIÓN CONTRATO MANTENIMIENTO ASCENSORES\nEl administrador informa de que el contrato con Otis S.A. vence el 31 de marzo. Otis ha ofrecido una renovación con una rebaja del 8% respecto al contrato actual, quedando el importe anual en 9.600€. Se han solicitado presupuestos a otras dos empresas cuyos precios resultan superiores. Se aprueba por unanimidad la renovación con Otis S.A.\n\nPUNTO 5 — PARKING DE VISITAS\nEl presidente expone la problemática generada por el mal uso del parking de visitas: varios vehículos permanecen estacionados durante semanas, impidiendo el uso por parte de los visitantes reales. Se propone limitar el uso a 48 horas consecutivas con comunicación previa a portería y habilitar un sistema de reservas online. Tras debate, se aprueba la medida por 36 votos a favor y 5 abstenciones.\n\nPUNTO 6 — REGLAMENTO INTERNO\nEl administrador presenta una propuesta de actualización del reglamento de convivencia que incluye: regulación del uso de las terrazas para barbacoas (horario máximo hasta las 23:00 h en verano y 22:00 h en invierno), prohibición de tender ropa en las barandillas exteriores de las terrazas a la vista de la calle, y normas para el uso de la sala polivalente con reserva previa mínima de 48 horas. Se aprueba el nuevo reglamento por mayoría: 33 a favor, 4 en contra, 4 abstenciones.\n\nPUNTO 7 — MOROSIDAD\nEl administrador informa de que la morosidad actual es del 4,2%, correspondiente a 4 propietarios con deudas que oscilan entre 180€ y 540€. Se propone y aprueba un plan de pagos fraccionados de hasta 6 mensualidades sin recargo para deudas inferiores a 600€.\n\nPUNTO 8 — CÁMARAS DE VIGILANCIA EN GARAJE\nEl presidente propone instalar dos cámaras adicionales en el garaje tras varios incidentes de robo de objetos de vehículos. Varios propietarios apoyan la medida pero solicitan que se recaben presupuestos antes de votar. Se acuerda aplazar el punto a la próxima junta con al menos tres presupuestos sobre la mesa.\n\nSin más asuntos que tratar, el presidente levanta la sesión a las 21:22 horas, de lo que yo, el secretario, doy fe.",
    createdBy: "Antonio Vega",
    status: "draft",
  },
  {
    id: "a1",
    title: "Junta Ordinaria - Enero 2024",
    date: "2024-01-15",
    executiveSummary:
      "Se celebró la Junta Ordinaria con asistencia del 78% de los propietarios. Se trataron los presupuestos del ejercicio 2024, la renovación del ascensor del bloque A y el cambio de horarios de la piscina para la temporada de verano.",
    agreements: [
      "Aprobación de presupuestos 2024 con incremento del 3%",
      "Renovación del ascensor del bloque A por unanimidad (presupuesto: 15.000€)",
      "Nuevo horario de piscina: 10:00-21:00 (junio-septiembre)",
      "Contratación de empresa de jardinería trimestral",
    ],
    transcript:
      "El presidente abre la sesión a las 19:00 horas con la asistencia del 78% de los propietarios. Se procede a la lectura del orden del día.\n\nPunto 1 - Presupuestos 2024: El administrador presenta los presupuestos con un incremento del 3% respecto al año anterior, justificado por el aumento de costes energéticos. Se somete a votación y se aprueba por mayoría.\n\nPunto 2 - Renovación ascensor: Se presentan tres presupuestos. Se acuerda por unanimidad aceptar el de la empresa Elevadores Madrid S.L. por 15.000€.\n\nPunto 3 - Horario piscina: Tras debate, se acuerda mantener el horario de 10:00 a 21:00.\n\nSe levanta la sesión a las 20:45 horas.",
    createdBy: "Carlos García",
    status: "published",
  },
  {
    id: "a2",
    title: "Junta Extraordinaria - Diciembre 2023",
    date: "2023-12-10",
    executiveSummary:
      "Junta extraordinaria convocada para tratar la avería urgente del sistema de calefacción central. Se aprobó la reparación con carácter urgente y una derrama para cubrir los costes.",
    agreements: [
      "Contratación urgente de reparación de calefacción (8.500€)",
      "Derrama de 50€ por vivienda",
      "Plazo de pago: 30 días",
    ],
    transcript:
      "Se convoca junta extraordinaria por avería del sistema de calefacción central. El administrador expone la situación y presenta el presupuesto de reparación. Se aprueba por mayoría la derrama de 50€ por vivienda.",
    createdBy: "Carlos García",
    status: "published",
  },
];

