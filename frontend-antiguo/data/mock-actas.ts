import { Acta } from "@/types/acta";

export const MOCK_ACTAS: Acta[] = [
  {
    id: "a3",
    association_id: "mock-assoc",
    type: "ORDINARY",
    status: "DRAFT",
    version: 1,
    title: "Junta Ordinaria - Marzo 2024",
    scheduled_at: "2024-03-12T18:30:00Z",
    location: "Salón de actos",
    summary:
      "Se celebró la Junta Ordinaria de Propietarios de la Comunidad Residencial Las Encinas con una asistencia récord del 91% de los propietarios, tanto en persona como por representación. La reunión, que se prolongó durante casi tres horas, abordó en profundidad la situación financiera de la comunidad tras el cierre del ejercicio 2023, el estado de las instalaciones comunes tras el invierno, la propuesta de instalación de paneles solares en la cubierta del edificio principal, la renovación del contrato de mantenimiento de ascensores, la regulación del uso del parking de visitas, y la actualización del reglamento interno de convivencia. El administrador de fincas, D. Ramón Fuentes, presentó un informe detallado sobre la morosidad, que se sitúa en el 4,2% del total de cuotas, y propuso un plan de pagos fraccionados para los deudores. Se aprobaron todas las propuestas sometidas a votación salvo la instalación de cámaras de vigilancia adicionales en el garaje, que quedó aplazada para recabar más presupuestos. El ambiente fue constructivo y participativo, con numerosas intervenciones de los vecinos.",
    agreements: [
      {
        description: "Aprobación de las cuentas del ejercicio 2023 con superávit de 3.200€ por unanimidad.",
        result: "APPROVED",
        details: "Por unanimidad"
      }
    ],
    topics: [
      "Situación financiera y cierre del ejercicio 2023",
      "Presupuesto ordinario 2024",
    ],
    tasks: [
      {
        responsible: "Administrador Ramón Fuentes",
        description:
          "Solicitar un mínimo de tres presupuestos a empresas instaladoras de placas solares homologadas.",
        deadline: "2024-04-30",
      }
    ],
    attendees: [],
    transcription:
      "El presidente, D. Antonio Vega, abre la sesión a las 18:30 horas en el salón de actos de la comunidad...",
  },
  {
    id: "a1",
    association_id: "mock-assoc",
    type: "ORDINARY",
    status: "SIGNED",
    version: 1,
    title: "Junta Ordinaria - Enero 2024",
    scheduled_at: "2024-01-15T19:00:00Z",
    location: "Salón de actos",
    summary:
      "Se celebró la Junta Ordinaria con asistencia del 78% de los propietarios. Se trataron los presupuestos del ejercicio 2024, la renovación del ascensor del bloque A y el cambio de horarios de la piscina para la temporada de verano.",
    agreements: [],
    transcription: "El presidente abre la sesión a las 19:00 horas...",
    topics: [],
    tasks: [],
    attendees: []
  },
];
